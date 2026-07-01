/**
 * Proforma Invoice HTML renderer — faithful to the Flowzint Tax Invoice layout
 * (uploads/Flowzint_Proforma_Invoice_Template.docx). Produces a self-contained,
 * print-ready A4 HTML document. The PDF renderer rasterizes this exact HTML, so
 * the HTML is the single source of visual truth.
 *
 * All values are pre-formatted strings supplied by the invoice service; this
 * module performs NO math and NO data access — it is pure presentation, which
 * makes it trivially unit-testable.
 */

export type InvoiceViewModel = {
  piNumber: string;
  piDate: string; // DD/MM/YYYY
  orderId: string;
  validUntil: string;
  quoteRef: string;

  company: { name: string; address: string[]; pan: string; gstin: string; phone: string; email: string };

  client: {
    businessName: string;
    promoterName: string;
    address: string;
    cityStatePin: string;
    state: string;
    stateCode: string;
    gst: string;
    mobile: string;
    email: string;
  };
  consignee: {
    businessName: string;
    name: string;
    address: string;
    cityStatePin: string;
    state: string;
    stateCode: string;
    gst: string;
  };

  hsnCode: string;
  item: {
    description: string;
    size: string;
    colour: string;
    grammage: string;
    grade: string;
    qtyKg: string;
    ratePerKg: string;
    lam: string;
    taxableValue: string;
  };

  taxType: "IGST" | "CGST_SGST";
  igstAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  grandTotalFigure: string;
  grandTotalWords: string;

  tokenMin: string;
  tokenMax: string;

  transporter: string;
  vehicleNo: string;
  lrNo: string;
  destination: string;
  transportMode: string;
  remark: string;

  bankBlock: string;
  upiDetails: string;
};

function esc(s: string): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

export function renderInvoiceHtml(vm: InvoiceViewModel): string {
  const taxRows =
    vm.taxType === "IGST"
      ? `<tr><td>IGST @ 18%</td><td class="amt">₹ ${esc(vm.igstAmount)}</td></tr>`
      : `<tr><td>CGST @ 9%</td><td class="amt">₹ ${esc(vm.cgstAmount)}</td></tr>
         <tr><td>SGST @ 9%</td><td class="amt">₹ ${esc(vm.sgstAmount)}</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/>
<title>Proforma Invoice ${esc(vm.piNumber)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, "Helvetica Neue", sans-serif; color: #111; font-size: 11px; margin: 0; }
  .doc { width: 186mm; margin: 0 auto; }
  .border { border: 1.5px solid #111; }
  .head { text-align: center; padding: 8px; border-bottom: 1.5px solid #111; }
  .head h1 { margin: 0; font-size: 20px; letter-spacing: 1px; }
  .head .addr { font-size: 10px; line-height: 1.4; margin-top: 2px; }
  .badge { display:inline-block; margin-top:4px; padding:2px 10px; border:1px solid #111; font-weight:bold; }
  .meta, .parties, table.items, .totals { width: 100%; border-collapse: collapse; }
  .row { display: flex; }
  .col { flex: 1; padding: 6px 8px; }
  .col + .col { border-left: 1.5px solid #111; }
  .label { font-weight: bold; }
  .section-title { font-weight: bold; border-bottom: 1px solid #111; padding-bottom: 2px; margin-bottom: 4px; }
  table.items th, table.items td { border: 1px solid #111; padding: 4px 5px; text-align: center; }
  table.items th { background: #f0f0f0; }
  td.left { text-align: left; }
  .totals td { padding: 4px 8px; border: 1px solid #111; }
  .amt { text-align: right; white-space: nowrap; }
  .token { border: 1.5px solid #111; padding: 8px; margin-top: 6px; text-align: center; font-weight: bold; }
  .terms { font-size: 9.5px; line-height: 1.5; padding: 8px; }
  .terms li { margin-bottom: 1px; }
  .bank { white-space: pre-line; font-size: 10px; }
  .sign { height: 50px; }
  .watermark { text-align:center; font-size:10px; color:#555; padding:4px; border-top:1px dashed #888; }
  .pi-banner { background:#111; color:#fff; text-align:center; padding:3px; font-weight:bold; letter-spacing:1px; }
</style></head>
<body><div class="doc border">
  <div class="pi-banner">PROFORMA INVOICE</div>
  <div class="head">
    <h1>${esc(vm.company.name)}</h1>
    <div class="addr">${vm.company.address.map(esc).join("<br/>")}<br/>
      PAN: ${esc(vm.company.pan)} &nbsp;|&nbsp; GSTIN: ${esc(vm.company.gstin)}<br/>
      Phone: ${esc(vm.company.phone)} &nbsp;|&nbsp; Email: ${esc(vm.company.email)}</div>
    <div class="badge">Division: PP WOVEN BOX</div>
  </div>

  <div class="row" style="border-bottom:1.5px solid #111;">
    <div class="col">
      <div><span class="label">PI No.:</span> ${esc(vm.piNumber)}</div>
      <div><span class="label">PI Date:</span> ${esc(vm.piDate)}</div>
      <div><span class="label">Order No.:</span> ${esc(vm.orderId)}</div>
    </div>
    <div class="col">
      <div><span class="label">Valid Till:</span> ${esc(vm.validUntil)}</div>
      <div><span class="label">Ref. Quot.:</span> ${esc(vm.quoteRef)}</div>
      <div style="font-size:9px;color:#555;">This is a Proforma Invoice only. Tax Invoice issued on dispatch.</div>
    </div>
  </div>

  <div class="row" style="border-bottom:1.5px solid #111;">
    <div class="col">
      <div class="section-title">Details of Receiver (Billed To)</div>
      <div><b>${esc(vm.client.businessName)}</b></div>
      <div>${esc(vm.client.promoterName)}</div>
      <div>${esc(vm.client.address)}</div>
      <div>${esc(vm.client.cityStatePin)}</div>
      <div>State: ${esc(vm.client.state)} &nbsp; State Code: ${esc(vm.client.stateCode)}</div>
      <div>GSTIN: ${esc(vm.client.gst)}</div>
      <div>Mobile: ${esc(vm.client.mobile)} &nbsp; Email: ${esc(vm.client.email)}</div>
    </div>
    <div class="col">
      <div class="section-title">Details of Consignee (Shipped To)</div>
      <div><b>${esc(vm.consignee.businessName)}</b></div>
      <div>${esc(vm.consignee.name)}</div>
      <div>${esc(vm.consignee.address)}</div>
      <div>${esc(vm.consignee.cityStatePin)}</div>
      <div>State: ${esc(vm.consignee.state)} &nbsp; State Code: ${esc(vm.consignee.stateCode)}</div>
      <div>GSTIN: ${esc(vm.consignee.gst)}</div>
    </div>
  </div>

  <table class="items">
    <thead><tr>
      <th>S.No</th><th>Description &amp; Specification</th><th>Size (Inch)</th><th>Colour</th>
      <th>Grammage</th><th>Grade</th><th>Qty (KG)</th><th>Rate/KG (₹)</th><th>Lam.</th><th>Taxable Value (₹)</th>
    </tr></thead>
    <tbody>
      <tr>
        <td>1</td>
        <td class="left">${esc(vm.item.description)}<br/>HSN: ${esc(vm.hsnCode)}</td>
        <td>${esc(vm.item.size)}"</td>
        <td>${esc(vm.item.colour)}</td>
        <td>${esc(vm.item.grammage)}</td>
        <td>${esc(vm.item.grade)}</td>
        <td>${esc(vm.item.qtyKg)}</td>
        <td>${esc(vm.item.ratePerKg)}</td>
        <td>${esc(vm.item.lam)}</td>
        <td class="amt">${esc(vm.item.taxableValue)}</td>
      </tr>
      <tr>
        <td colspan="6" class="left"><b>TOTAL</b></td>
        <td><b>${esc(vm.item.qtyKg)}</b></td><td>—</td><td>—</td>
        <td class="amt"><b>${esc(vm.item.taxableValue)}</b></td>
      </tr>
    </tbody>
  </table>

  <div class="row">
    <div class="col" style="font-size:10px;">
      <div>Transporter: ${esc(vm.transporter)}</div>
      <div>Vehicle No.: ${esc(vm.vehicleNo)}</div>
      <div>L.R. No.: ${esc(vm.lrNo)}</div>
      <div>Destination: ${esc(vm.destination)}</div>
      <div>Mode: ${esc(vm.transportMode)}</div>
      <div>Remark: ${esc(vm.remark)}</div>
    </div>
    <div class="col">
      <table class="totals">
        <tr><td>Taxable Value</td><td class="amt">₹ ${esc(vm.item.taxableValue)}</td></tr>
        ${taxRows}
        <tr><td><b>GRAND TOTAL</b></td><td class="amt"><b>₹ ${esc(vm.grandTotalFigure)}</b></td></tr>
      </table>
      <div style="padding:4px 0;"><b>In Words:</b> ${esc(vm.grandTotalWords)}</div>
    </div>
  </div>

  <div class="token">
    TOKEN ADVANCE REQUIRED TO START PRODUCTION<br/>
    Minimum Token (10%): ₹ ${esc(vm.tokenMin)} &nbsp;&nbsp;|&nbsp;&nbsp; Maximum Token (25%): ₹ ${esc(vm.tokenMax)}<br/>
    <span style="font-weight:normal;font-size:9.5px;">Production begins the same day token advance is received and confirmed. Order slot held for 3 days.</span>
  </div>

  <div class="row" style="border-top:1.5px solid #111;">
    <div class="col">
      <div class="section-title">Terms &amp; Conditions</div>
      <ul class="terms" style="margin:0;padding-left:16px;">
        <li>This is a Proforma Invoice only. Binding Tax Invoice issued on dispatch.</li>
        <li>All prices are Ex-Factory, Surat. GST, freight &amp; insurance extra.</li>
        <li>Token advance of 10%–25% of order value is mandatory before production start.</li>
        <li>Balance payment due before or at time of dispatch unless otherwise agreed.</li>
        <li>Any complaint regarding goods must be reported in writing within 24 hours.</li>
        <li>Goods sold will not be taken back. Subject to Surat jurisdiction only.</li>
        <li>Interest @ 21% p.a. on overdue payments beyond 30 days.</li>
      </ul>
    </div>
    <div class="col">
      <div class="section-title">Bank Details</div>
      <div class="bank">${esc(vm.bankBlock)}</div>
      <div style="margin-top:6px;"><b>UPI / Payment:</b> ${esc(vm.upiDetails || "—")}</div>
      <div style="margin-top:18px;">For, ${esc(vm.company.name)}</div>
      <div class="sign"></div>
      <div>Authorised Signatory</div>
    </div>
  </div>

  <div class="watermark">Generated by Flowzint AI Sales OS (Ravi) · PI ${esc(vm.piNumber)} · Order ${esc(vm.orderId)} · ${esc(vm.piDate)}</div>
</div></body></html>`;
}
