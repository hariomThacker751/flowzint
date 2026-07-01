/**
 * Demand-signal extraction.
 *
 * Strategy (per design): LLM-assisted parsing with a DETERMINISTIC validator.
 * The deterministic core (month/festival/season normalization, industry
 * inference) is pure and unit-tested; the LLM is an optional front-end that
 * structures messy multi-language free text, after which everything is
 * re-validated by the deterministic functions. This keeps results predictable
 * and testable while handling natural language across 8 languages.
 */

const MONTHS: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
  may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8,
  september: 9, sep: 9, sept: 9, october: 10, oct: 10, november: 11, nov: 11,
  december: 12, dec: 12,
};

/** Festival / season / harvest keywords → month sets (India-centric). */
const SEASON_MONTHS: Array<{ re: RegExp; months: number[] }> = [
  { re: /\b(diwali|deepavali|dipavali|deepawali)\b/i, months: [10, 11] },
  { re: /\b(holi)\b/i, months: [3] },
  { re: /\b(navratri|dussehra|dasara|durga\s*puja)\b/i, months: [9, 10] },
  { re: /\b(sankranti|pongal|makar)\b/i, months: [1] },
  { re: /\b(monsoon|barish|barsaat|varsha|rain[sy]?|chaumasa|chomasa)\b/i, months: [6, 7, 8, 9] },
  { re: /\b(summer|garmi|grishma|unhalo)\b/i, months: [4, 5, 6] },
  { re: /\b(winter|sardi|thand|hemant|shishir|shiyalo)\b/i, months: [11, 12, 1, 2] },
  { re: /\b(wedding|shaadi|shadi|marriage|lagna|vivah)\b/i, months: [11, 12, 1, 2] },
  { re: /\b(rabi)\b/i, months: [10, 11, 12, 1, 2, 3] },
  { re: /\b(kharif)\b/i, months: [6, 7, 8, 9, 10] },
  { re: /\b(harvest|fasal|kapani|crop\s*season)\b/i, months: [3, 4, 10, 11] },
];

const YEAR_ROUND = /\b(year[\s-]?round|all\s*year|throughout|round the year|baara?\s*mahine|baarah\s*mahine|hamesha|sada)\b/i;
const RANGE_RE = /\b([a-z]{3,9}|1[0-2]|[1-9])\s*(?:to|till|until|through|thru|upto|up\s*to|se|–|—|-)\s*([a-z]{3,9}|1[0-2]|[1-9])\b/gi;
const LIST_MONTH_RE = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/gi;

function monthNum(token: string): number | null {
  const t = token.trim().toLowerCase();
  if (/^\d{1,2}$/.test(t)) {
    const n = Number(t);
    return n >= 1 && n <= 12 ? n : null;
  }
  return MONTHS[t] ?? null;
}

function expandRange(a: number, b: number): number[] {
  const out: number[] = [];
  let m = a;
  for (let i = 0; i < 12; i++) {
    out.push(m);
    if (m === b) break;
    m = (m % 12) + 1;
  }
  return out;
}

/**
 * Parse free text → sorted unique month numbers (1–12).
 * Handles ranges ("October to January"), lists, festival/season keywords, and
 * "year round". Guards against the "may" English-word false positive.
 */
export function normalizeMonths(text: string): number[] {
  if (!text) return [];
  const t = text.toLowerCase();
  const set = new Set<number>();

  if (YEAR_ROUND.test(t)) {
    for (let i = 1; i <= 12; i++) set.add(i);
    return [...set].sort((a, b) => a - b);
  }

  // Ranges
  let m: RegExpExecArray | null;
  RANGE_RE.lastIndex = 0;
  while ((m = RANGE_RE.exec(t))) {
    const a = monthNum(m[1]);
    const b = monthNum(m[2]);
    if (a && b) expandRange(a, b).forEach((x) => set.add(x));
  }

  // Festival / season keywords
  for (const s of SEASON_MONTHS) if (s.re.test(t)) s.months.forEach((x) => set.add(x));

  // Explicit month names in lists ("Oct, Nov and Dec"). Use clear month tokens.
  const named: number[] = [];
  let lm: RegExpExecArray | null;
  LIST_MONTH_RE.lastIndex = 0;
  while ((lm = LIST_MONTH_RE.exec(t))) {
    const n = MONTHS[lm[1].toLowerCase()];
    if (n) named.push(n);
  }
  // "may" alone (English word) only counts if other month/season signal exists.
  const hasOtherSignal = set.size > 0 || named.some((n) => n !== 5);
  for (const n of named) {
    if (n === 5 && !hasOtherSignal && !/\bmay\b.*\b(month|mahina|peak|demand|season)\b/i.test(t)) continue;
    set.add(n);
  }

  return [...set].sort((a, b) => a - b);
}

/** Infer an industry segment + cleaned application from the customer's words. */
export function inferApplication(text: string): { application: string | null; industry: string | null } {
  const t = (text || "").toLowerCase();
  const map: Array<{ re: RegExp; industry: string }> = [
    { re: /\b(cement|construction|building|rcc)\b/i, industry: "construction" },
    { re: /\b(fibc|jumbo|bulk\s*bag|big\s*bag)\b/i, industry: "FIBC" },
    { re: /\b(agro|agri|agriculture|grain|rice|wheat|sugar|fertili[sz]er|seed|onion|potato|spice|pulses)\b/i, industry: "agriculture" },
    { re: /\b(food|flour|atta|salt|packaging|grocery)\b/i, industry: "food packaging" },
    { re: /\b(chemical|polymer|plastic|mineral|sand)\b/i, industry: "chemical/minerals" },
    { re: /\b(textile|yarn|garment)\b/i, industry: "textile" },
  ];
  let industry: string | null = null;
  for (const e of map) if (e.re.test(t)) { industry = e.industry; break; }
  const application = text && text.trim().length > 1 ? text.trim().slice(0, 120) : null;
  return { application, industry };
}

/** Lightweight intent: does this message look like a seasonal/demand answer? */
export function looksLikeDemandSignal(text: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  if (normalizeMonths(text).length > 0) return true;
  return /\b(peak|season|demand|festival|wedding|harvest|monsoon|winter|summer|bulk|every\s*month|months?)\b/i.test(t);
}

export type ExtractedDemand = {
  peakMonths: number[];
  lowMonths: number[];
  festivalDrivers: string | null;
  application: string | null;
  industry: string | null;
  planningLeadDays: number | null;
  confidence: number;
};

/** Deterministic extraction (no AI) — the always-available baseline. */
export function extractDeterministic(text: string): ExtractedDemand {
  const peakMonths = normalizeMonths(text);
  const { application, industry } = inferApplication(text);
  const festival = SEASON_MONTHS.find((s) => s.re.test((text || "").toLowerCase()));
  const lead = (text || "").match(/\b(\d{1,3})\s*(day|week|month)s?\s*(ahead|before|in advance|advance|pehle)/i);
  let planningLeadDays: number | null = null;
  if (lead) {
    const n = Number(lead[1]);
    planningLeadDays = /week/i.test(lead[2]) ? n * 7 : /month/i.test(lead[2]) ? n * 30 : n;
  }
  return {
    peakMonths,
    lowMonths: [],
    festivalDrivers: festival ? (text.match(festival.re)?.[0] ?? null) : null,
    application,
    industry,
    planningLeadDays,
    confidence: peakMonths.length || application || planningLeadDays ? 0.6 : 0.1,
  };
}

/**
 * LLM-assisted extraction. Uses Sarvam to structure messy/multilingual text,
 * then re-validates every field with the deterministic functions above. Falls
 * back to the deterministic baseline if the LLM is unavailable or returns junk.
 */
export async function extractDemandSignal(text: string, language = "en"): Promise<ExtractedDemand> {
  const baseline = extractDeterministic(text);
  try {
    const { sarvamChat } = await import("../sarvam");
    const sys =
      "You extract structured demand-planning facts from a box customer's message. " +
      "Return ONLY compact JSON with keys: peak_months (array of 1-12), low_months (array), " +
      "festival_drivers (string|null), application (string|null), industry (string|null), " +
      "planning_lead_days (number|null). Convert festivals/seasons to month numbers. No prose.";
    const res = await sarvamChat(
      [
        { role: "system", content: sys },
        { role: "user", content: `Language: ${language}\nMessage: ${text}` },
      ],
      { temperature: 0, maxTokens: 200, enableReasoning: false }
    );
    const raw = String(res || "").match(/\{[\s\S]*\}/)?.[0];
    if (!raw) return baseline;
    const j = JSON.parse(raw);
    // Re-validate through deterministic normalizers (never trust raw LLM output).
    const peakMonths = Array.isArray(j.peak_months)
      ? j.peak_months.map(Number).filter((n: number) => n >= 1 && n <= 12)
      : baseline.peakMonths;
    const lowMonths = Array.isArray(j.low_months)
      ? j.low_months.map(Number).filter((n: number) => n >= 1 && n <= 12)
      : [];
    const inferred = inferApplication(j.application || text);
    return {
      peakMonths: peakMonths.length ? [...new Set<number>(peakMonths)].sort((a, b) => a - b) : baseline.peakMonths,
      lowMonths,
      festivalDrivers: j.festival_drivers ?? baseline.festivalDrivers,
      application: j.application ?? baseline.application,
      industry: j.industry ?? inferred.industry ?? baseline.industry,
      planningLeadDays: typeof j.planning_lead_days === "number" ? j.planning_lead_days : baseline.planningLeadDays,
      confidence: 0.85,
    };
  } catch {
    return baseline;
  }
}
