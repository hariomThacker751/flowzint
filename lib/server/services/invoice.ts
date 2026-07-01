import { getDatabase } from "../database";
import { amountInWords, formatINR, lineTotalPaise } from "../money";
import { computeTax, stateCodeFromGstin } from "./tax";
import { computeTokenRange, getCompanyConfig } from "./policy";
import { nextSequence } from "./sequence";
import { renderInvoiceHtml, type InvoiceViewModel } from "./invoice-template";
import { renderInvoiceDocument } from "./pdf";
import { appendTimeline, getOrder } from "./order";

/**
 * Invoice service — Proforma Invoice generation (Implementation Spec §1).
 *
 * Responsibilities:
 *   - Allocate a daily-sequential PI number (PI-YYYYMMDD-NNN) atomically.
 *   - Compute tax (IGST vs CGST+SGST) and token range from the order value.
 *   - Map every {{PI_*}} variable from order + customer + config.
 *   - Persist an invoices row, render HTML + PDF.
 *   - Distribute to the client + internal group (dual distribution).
 *
 * Idempotent per order: regenerating versions the existing PI (never renumbers).
 */

function ddmmyyyy(d: Date): string {
  return d.toLocaleDateString("en-GB");
}

function allocatePiNumber(): string {
  const now = new Date();
  const key = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const seq = nextSequence("pi", key);
  return `PI-${key}-${String(seq).padStart(3, "0")}`;
}

export type InvoiceRow = {
  id: string;
  pi_number: string;
  order_id: string;
  customer_id: string;
  tax_type: "IGST" | "CGST_SGST";
  taxable_value_paise: number;
  igst_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  grand_total_paise: number;
  token_min_paise: number;
  token_max_paise: number;
  version: number;
  html_path: string | null;
  pdf_path: string | null;
  [k: string]: any;
};

export async function generateProformaInvoice(
  orderId: string,
  opts: { quoteRef?: string } = {}
): Promise<{ invoice: InvoiceRow; html: string; pdfGenerated: boolean }> {
  const db = getDatabase();
  const order = getOrder(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  const customer = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(order.customer_id) as Record<string, any>;
  if (!customer) throw new Error(`Customer not found for order ${orderId}`);

  const company = getCompanyConfig();

  // Exact taxable value in paise, then tax + tokens.
  const taxablePaise = lineTotalPaise(order.unit_price, order.quantity_kg);
  const tax = computeTax(taxablePaise, customer.gst_number);
  const tokens = computeTokenRange(tax.grandTotalPaise);

  const now = new Date();
  const validUntil = new Date(now.getTime() + company.invoiceValidityDays * 86400000);

  // Idempotency: one PI per order. Reuse number, bump version on regeneration.
  const existing = db.prepare(`SELECT * FROM invoices WHERE order_id = ?`).get(orderId) as InvoiceRow | undefined;
  const piNumber = existing ? existing.pi_number : allocatePiNumber();
  const version = existing ? existing.version + 1 : 1;
  const piDate = existing?.pi_date ?? ddmmyyyy(now);

  const stateCode = stateCodeFromGstin(customer.gst_number) || customer.state_code || "";

  const vm: InvoiceViewModel = {
    piNumber,
    piDate,
    orderId: order.order_no,
    validUntil: ddmmyyyy(validUntil),
    quoteRef: opts.quoteRef || order.quote_id || "—",
    company: {
      name: company.name,
      address: ["949-A, PLOT NO.7, KIM TADKESHWAR ROAD", "TALUKA MANDVI, DISTRICT SURAT", "PINCODE: 394170"],
      pan: "ABJFA5190P",
      gstin: company.gstin,
      phone: customer.company_phone || "—",
      email: "info@flowzintinterweave.com",
    },
    client: {
      businessName: customer.business_name || customer.company || customer.name || "—",
      promoterName: customer.promoter_name || customer.name || "",
      address: customer.principal_address || "",
      cityStatePin: [customer.city, customer.state, customer.pincode].filter(Boolean).join(", "),
      state: customer.state || "",
      stateCode,
      gst: customer.gst_number || "UNREGISTERED",
      mobile: customer.phone || "",
      email: customer.email || "",
    },
    consignee: {
      businessName: customer.business_name || customer.company || customer.name || "—",
      name: customer.promoter_name || customer.name || "",
      address: customer.principal_address || "",
      cityStatePin: [customer.city, customer.state, customer.pincode].filter(Boolean).join(", "),
      state: customer.state || "",
      stateCode,
      gst: customer.gst_number || "UNREGISTERED",
    },
    hsnCode: company.hsnPpBox,
    item: {
      description: "PP WOVEN BOX ROLL",
      size: String(order.size_inches),
      colour: order.color,
      grammage: `${order.grammage}g`,
      grade: order.quality,
      qtyKg: String(order.quantity_kg),
      ratePerKg: order.unit_price.toFixed(2),
      lam: order.lamination,
      taxableValue: formatINR(taxablePaise),
    },
    taxType: tax.taxType,
    igstAmount: formatINR(tax.igstPaise),
    cgstAmount: formatINR(tax.cgstPaise),
    sgstAmount: formatINR(tax.sgstPaise),
    grandTotalFigure: formatINR(tax.grandTotalPaise),
    grandTotalWords: amountInWords(tax.grandTotalPaise),
    tokenMin: formatINR(tokens.minPaise),
    tokenMax: formatINR(tokens.maxPaise),
    transporter: "",
    vehicleNo: "",
    lrNo: "",
    destination: customer.city || customer.delivery_city || "",
    transportMode: "BY ROAD",
    remark: "",
    bankBlock: company.bankBlock,
    upiDetails: company.upiDetails,
  };

  const html = renderInvoiceHtml(vm);
  const render = await renderInvoiceDocument(piNumber, html);

  const id = existing?.id ?? crypto.randomUUID();
  if (existing) {
    db.prepare(
      `UPDATE invoices SET version=?, taxable_value_paise=?, igst_paise=?, cgst_paise=?, sgst_paise=?,
        grand_total_paise=?, grand_total_words=?, token_min_paise=?, token_max_paise=?, tax_type=?,
        html_path=?, pdf_path=? WHERE id=?`
    ).run(
      version, taxablePaise, tax.igstPaise, tax.cgstPaise, tax.sgstPaise, tax.grandTotalPaise,
      vm.grandTotalWords, tokens.minPaise, tokens.maxPaise, tax.taxType,
      render.htmlPath, render.pdfPath, id
    );
  } else {
    db.prepare(
      `INSERT INTO invoices
        (id, pi_number, order_id, customer_id, pi_date, valid_until, tax_type, hsn_code,
         taxable_value_paise, igst_paise, cgst_paise, sgst_paise, grand_total_paise, grand_total_words,
         token_min_paise, token_max_paise, version, html_path, pdf_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, piNumber, orderId, order.customer_id, piDate, ddmmyyyy(validUntil), tax.taxType, company.hsnPpBox,
      taxablePaise, tax.igstPaise, tax.cgstPaise, tax.sgstPaise, tax.grandTotalPaise, vm.grandTotalWords,
      tokens.minPaise, tokens.maxPaise, version, render.htmlPath, render.pdfPath
    );
  }

  appendTimeline(
    order.customer_id,
    orderId,
    "pi_generated",
    `Proforma Invoice ${piNumber} generated (v${version}). Grand total ₹${formatINR(tax.grandTotalPaise)} (${tax.taxType}).`,
    "system"
  );

  const invoice = db.prepare(`SELECT * FROM invoices WHERE id = ?`).get(id) as InvoiceRow;
  return { invoice, html, pdfGenerated: render.pdfGenerated };
}

/**
 * Dual distribution (Impl Spec §1.1): send the PI PDF to the client's WhatsApp
 * and the internal group. Uses a public link to the served document so ChakraHQ
 * can fetch it. Records send timestamps. Non-fatal on send failure (logged).
 */
export async function distributeProformaInvoice(
  invoiceId: string,
  ctx: { clientPhone: string; clientCaption: string; internalCaption: string }
): Promise<{ clientSent: boolean; internalSent: boolean }> {
  const db = getDatabase();
  const invoice = db.prepare(`SELECT * FROM invoices WHERE id = ?`).get(invoiceId) as InvoiceRow | undefined;
  if (!invoice) throw new Error(`Invoice not found: ${invoiceId}`);

  const company = getCompanyConfig();
  const baseUrl = process.env.PUBLIC_BASE_URL || "";
  const { signResourceToken } = await import("../auth");
  const token = signResourceToken("invoice", invoice.id);
  const docUrl = baseUrl ? `${baseUrl.replace(/\/$/, "")}/api/invoices/${invoice.id}/pdf?t=${token}` : "";
  const filename = `${invoice.pi_number}.pdf`;

  const { sendMediaMessage } = await import("../chakra");

  let clientSent = false;
  let internalSent = false;

  if (ctx.clientPhone && docUrl) {
    try {
      await sendMediaMessage(ctx.clientPhone, docUrl, ctx.clientCaption, filename);
      db.prepare(`UPDATE invoices SET sent_client_at = datetime('now') WHERE id = ?`).run(invoice.id);
      clientSent = true;
    } catch (e) {
      console.error("[invoice] client PI send failed:", e);
    }
  }

  if (company.internalGroupPhone && docUrl) {
    try {
      await sendMediaMessage(company.internalGroupPhone, docUrl, ctx.internalCaption, filename);
      db.prepare(`UPDATE invoices SET sent_internal_at = datetime('now') WHERE id = ?`).run(invoice.id);
      internalSent = true;
    } catch (e) {
      console.error("[invoice] internal PI send failed:", e);
    }
  }

  return { clientSent, internalSent };
}
