import { inflateRawSync } from "node:zlib";

/**
 * Minimal, dependency-free XLSX reader.
 *
 * An .xlsx is a ZIP of XML parts. We parse the ZIP central directory, inflate
 * the needed parts (`workbook.xml`, its rels, `sharedStrings.xml`, the worksheet
 * XML), and extract rows as a 2D array of cell strings. This avoids a runtime
 * xlsx dependency (and the security advisories around some of them) and works
 * in every environment. It supports the common cases Excel/openpyxl/Sheets
 * produce: shared strings, inline strings, and numeric cells.
 */

// ── ZIP container ────────────────────────────────────────────────────────────

function unzip(buf: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  // End of Central Directory record
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Not a valid .xlsx (no ZIP end-of-central-directory)");
  const cdEntries = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16); // central directory offset

  for (let n = 0; n < cdEntries; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);

    // Read the local header to find where data begins.
    if (buf.readUInt32LE(localOffset) === 0x04034b50) {
      const lNameLen = buf.readUInt16LE(localOffset + 26);
      const lExtraLen = buf.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + lNameLen + lExtraLen;
      const raw = buf.subarray(dataStart, dataStart + compSize);
      const content = method === 0 ? Buffer.from(raw) : inflateRawSync(raw);
      files.set(name, content);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

// ── XML helpers ──────────────────────────────────────────────────────────────

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&");
}

function parseSharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  const out: string[] = [];
  for (const si of xml.match(/<si\b[\s\S]*?<\/si>/g) || []) {
    const parts = [...si.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decodeEntities(m[1]));
    out.push(parts.join(""));
  }
  return out;
}

function colToIndex(ref: string): number {
  const letters = ref.replace(/[0-9]/g, "");
  let idx = 0;
  for (const ch of letters) idx = idx * 26 + (ch.charCodeAt(0) - 64);
  return idx - 1;
}

function parseSheet(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  for (const rowXml of xml.match(/<row\b[\s\S]*?<\/row>/g) || []) {
    const cells: string[] = [];
    for (const c of rowXml.match(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || []) {
      const refMatch = c.match(/\sr="([A-Z]+)\d+"/);
      const idx = refMatch ? colToIndex(refMatch[1]) : cells.length;
      const t = (c.match(/\st="([^"]+)"/) || [])[1];
      let value = "";
      if (t === "inlineStr") {
        value = decodeEntities((c.match(/<t\b[^>]*>([\s\S]*?)<\/t>/) || [])[1] || "");
      } else {
        const v = (c.match(/<v\b[^>]*>([\s\S]*?)<\/v>/) || [])[1];
        if (v !== undefined) value = t === "s" ? shared[parseInt(v, 10)] ?? "" : decodeEntities(v);
      }
      while (cells.length < idx) cells.push("");
      cells[idx] = value;
    }
    rows.push(cells);
  }
  return rows;
}

// ── Public API ───────────────────────────────────────────────────────────────

export type ParsedSheet = { name: string; rows: string[][] };

/** Read all worksheets (name → rows). */
export function readXlsx(buf: Buffer): ParsedSheet[] {
  const files = unzip(buf);
  const shared = parseSharedStrings(files.get("xl/sharedStrings.xml")?.toString("utf8"));
  const workbook = files.get("xl/workbook.xml")?.toString("utf8") || "";
  const rels = files.get("xl/_rels/workbook.xml.rels")?.toString("utf8") || "";

  // name → r:id → target path. Attribute order varies between writers, so parse
  // each <Relationship> tag and pull Id + Target independently.
  const ridToTarget = new Map<string, string>();
  for (const tag of rels.match(/<Relationship\b[^>]*?\/?>/g) || []) {
    const id = (tag.match(/\bId="([^"]+)"/) || [])[1];
    const target = (tag.match(/\bTarget="([^"]+)"/) || [])[1];
    if (id && target) ridToTarget.set(id, target.replace(/^\/?xl\//, "").replace(/^\//, ""));
  }
  const sheets: ParsedSheet[] = [];
  const sheetTags = [...workbook.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/?>/g)];
  if (sheetTags.length) {
    for (const m of sheetTags) {
      const name = decodeEntities(m[1]);
      const target = ridToTarget.get(m[2]);
      const path = target ? `xl/${target}` : null;
      const xml = path ? files.get(path)?.toString("utf8") : undefined;
      if (xml) sheets.push({ name, rows: parseSheet(xml, shared) });
    }
  } else {
    // Fallback: just read sheet1
    const xml = files.get("xl/worksheets/sheet1.xml")?.toString("utf8");
    if (xml) sheets.push({ name: "Sheet1", rows: parseSheet(xml, shared) });
  }
  return sheets;
}

/** Read one worksheet by tab name (case-insensitive), or the first sheet. */
export function readXlsxSheet(buf: Buffer, tab?: string): ParsedSheet {
  const sheets = readXlsx(buf);
  if (!sheets.length) throw new Error("No worksheets found in .xlsx");
  if (tab) {
    const found = sheets.find((s) => s.name.toLowerCase() === tab.toLowerCase());
    if (found) return found;
  }
  return sheets[0];
}
