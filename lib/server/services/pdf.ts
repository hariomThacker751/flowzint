import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * PDF renderer port (ports & adapters).
 *
 * The invoice HTML is the source of visual truth. In production we rasterize it
 * with Puppeteer (added to package.json). Puppeteer is loaded DYNAMICALLY so the
 * app never crashes if it isn't installed yet — in that case we persist the HTML
 * and return its path, and the caller can still distribute a (printable) HTML or
 * defer PDF generation. This keeps the pipeline runnable in every environment.
 */

export type RenderResult = {
  htmlPath: string;
  pdfPath: string | null;
  pdfGenerated: boolean;
};

const INVOICE_DIR = path.join(process.cwd(), "data", "invoices");

export async function renderInvoiceDocument(piNumber: string, html: string): Promise<RenderResult> {
  await mkdir(INVOICE_DIR, { recursive: true });
  const safe = piNumber.replace(/[^A-Za-z0-9_-]/g, "_");
  const htmlPath = path.join(INVOICE_DIR, `${safe}.html`);
  await writeFile(htmlPath, html, "utf8");

  const pdfPath = path.join(INVOICE_DIR, `${safe}.pdf`);
  try {
    // Dynamic import — optional dependency. The specifier is held in a variable
    // so TypeScript does not statically require the (optional) module to exist.
    const moduleName = "puppeteer";
    const puppeteer = (await import(/* webpackIgnore: true */ moduleName).catch(() => null)) as any;
    if (!puppeteer) return { htmlPath, pdfPath: null, pdfGenerated: false };

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      await page.pdf({ path: pdfPath, format: "A4", printBackground: true });
    } finally {
      await browser.close();
    }
    return { htmlPath, pdfPath, pdfGenerated: true };
  } catch {
    return { htmlPath, pdfPath: null, pdfGenerated: false };
  }
}
