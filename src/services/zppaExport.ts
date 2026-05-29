/**
 * ZPPA (Zambia Public Procurement Authority) BOQ format export.
 * Produces an HTML document formatted to match the ZPPA standard BOQ template
 * used for government tender submissions in Zambia.
 */

import type { SketchBoQItem } from './sketchToBoQ';

// ZPPA section mapping — maps NRM-style codes to ZPPA Bill sections
const ZPPA_SECTIONS: Record<string, { bill: string; title: string }> = {
  A: { bill: 'A', title: 'PRELIMINARIES AND GENERAL REQUIREMENTS' },
  B: { bill: 'B', title: 'SUBSTRUCTURE' },
  C: { bill: 'C', title: 'SUPERSTRUCTURE — FRAME AND UPPER FLOORS' },
  D: { bill: 'D', title: 'EXTERNAL ENVELOPE — WALLS AND ROOFING' },
  E: { bill: 'E', title: 'INTERNAL FINISHES AND JOINERY' },
  F: { bill: 'F', title: 'MECHANICAL AND ELECTRICAL SERVICES' },
  G: { bill: 'G', title: 'EXTERNAL WORKS AND SITE DEVELOPMENT' },
  H: { bill: 'H', title: 'WATER SUPPLY AND SANITATION (WASH)' },
};

// Map item category to ZPPA bill letter
const CATEGORY_TO_BILL: Record<string, string> = {
  'Substructure':  'B',
  'Concrete':      'C',
  'Masonry':       'C',
  'Formwork':      'C',
  'Finishes':      'E',
  'Roofing':       'D',
  'WASH':          'H',
  'Earthworks':    'G',
  'Roads':         'G',
  'Electrical':    'F',
  'Labour':        'A',
};

interface ZppaItem {
  bill: string;
  billTitle: string;
  ref: string;
  description: string;
  unit: string;
  qty: number;
  rate_zmw: number;
  total_zmw: number;
}

export function formatZppaBoQ(items: SketchBoQItem[], projectDetails: {
  project_name: string;
  employer: string;
  location: string;
  contract_no?: string;
  date?: string;
  engineer?: string;
  eiz_no?: string;
}): string {
  // Group items by ZPPA bill
  const grouped = new Map<string, ZppaItem[]>();

  items.forEach((item, idx) => {
    const bill = CATEGORY_TO_BILL[item.category] ?? 'C';
    const billTitle = ZPPA_SECTIONS[bill]?.title ?? 'GENERAL';
    const ref = `${bill}/${String(idx + 1).padStart(3, '0')}`;

    const zppaItem: ZppaItem = {
      bill, billTitle, ref,
      description: item.description,
      unit: item.unit,
      qty: item.qty,
      rate_zmw: item.rate_zmw,
      total_zmw: item.total_zmw,
    };

    if (!grouped.has(bill)) grouped.set(bill, []);
    grouped.get(bill)!.push(zppaItem);
  });

  const grandTotal = items.reduce((s, i) => s + i.total_zmw, 0);
  const today = projectDetails.date ?? new Date().toLocaleDateString('en-ZM', { day: '2-digit', month: 'long', year: 'numeric' });

  // Build bill sections HTML
  let billsHtml = '';
  let summaryRows = '';

  for (const [bill, billItems] of Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const billTotal = billItems.reduce((s, i) => s + i.total_zmw, 0);
    const section = ZPPA_SECTIONS[bill] ?? { bill, title: 'GENERAL' };

    billsHtml += `
      <div class="page-break">
        <h3 class="bill-header">BILL ${section.bill} — ${section.title}</h3>
        <table>
          <thead>
            <tr>
              <th width="8%">Item Ref</th>
              <th width="42%">Description of Work</th>
              <th width="8%">Unit</th>
              <th width="12%">Quantity</th>
              <th width="15%">Rate (ZMW)</th>
              <th width="15%">Amount (ZMW)</th>
            </tr>
          </thead>
          <tbody>
            ${billItems.map((it) => `
              <tr>
                <td class="center">${it.ref}</td>
                <td>${it.description}</td>
                <td class="center">${it.unit}</td>
                <td class="right">${it.qty.toLocaleString('en-ZM', { maximumFractionDigits: 2 })}</td>
                <td class="right">${it.rate_zmw.toLocaleString('en-ZM', { maximumFractionDigits: 2 })}</td>
                <td class="right">${it.total_zmw.toLocaleString('en-ZM', { maximumFractionDigits: 2 })}</td>
              </tr>`).join('')}
            <tr class="subtotal">
              <td colspan="5" class="right"><strong>TOTAL CARRIED TO SUMMARY — BILL ${bill}</strong></td>
              <td class="right"><strong>${billTotal.toLocaleString('en-ZM', { maximumFractionDigits: 2 })}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>`;

    summaryRows += `
      <tr>
        <td>Bill ${section.bill}</td>
        <td>${section.title}</td>
        <td class="right">${billTotal.toLocaleString('en-ZM', { maximumFractionDigits: 2 })}</td>
      </tr>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>ZPPA Bill of Quantities — ${projectDetails.project_name}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Arial', sans-serif; font-size: 10pt; color: #000; margin: 20mm; }
    h1 { font-size: 14pt; text-align: center; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 4px; }
    h2 { font-size: 11pt; text-align: center; margin: 2px 0; }
    h3 { font-size: 10pt; text-align: center; margin: 2px 0 12px; color: #555; }
    .bill-header { font-size: 11pt; background: #1a1a2e; color: #fff; padding: 6px 10px; margin: 16px 0 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 9pt; }
    th { background: #dce3f0; border: 1px solid #999; padding: 4px 6px; text-align: left; font-weight: bold; }
    td { border: 1px solid #bbb; padding: 3px 6px; vertical-align: top; }
    .center { text-align: center; }
    .right { text-align: right; }
    .subtotal { background: #f0f0f0; }
    .subtotal td { font-weight: bold; }
    .grand-total { background: #1a1a2e; color: #fff; }
    .grand-total td { font-weight: bold; font-size: 11pt; }
    .project-info { border: 1px solid #999; padding: 8px; margin: 16px 0; font-size: 9pt; }
    .project-info table { border: none; margin: 0; }
    .project-info td { border: none; padding: 2px 8px 2px 0; }
    .declaration { margin-top: 24px; font-size: 9pt; border: 1px solid #999; padding: 12px; }
    .sig-block { display: flex; gap: 40px; margin-top: 20px; }
    .sig-line { flex: 1; border-top: 1px solid #000; padding-top: 4px; font-size: 8pt; }
    .zppa-ref { font-size: 8pt; color: #666; text-align: right; margin-top: 4px; }
    .page-break { page-break-before: auto; }
    @media print { .page-break { page-break-before: always; } body { margin: 15mm; } }
  </style>
</head>
<body>
  <h1>BILL OF QUANTITIES</h1>
  <h2>${projectDetails.project_name.toUpperCase()}</h2>
  <h3>Prepared for the Procurement of Works — ZPPA Standard Format</h3>
  <p class="zppa-ref">Ref: ZPPA Act No. 8 of 2020 — Public Procurement Regulations SI No. 28 of 2022</p>

  <div class="project-info">
    <table>
      <tr>
        <td><strong>Employer / Client:</strong></td><td>${projectDetails.employer}</td>
        <td><strong>Contract No.:</strong></td><td>${projectDetails.contract_no ?? 'TBC'}</td>
      </tr>
      <tr>
        <td><strong>Project Location:</strong></td><td>${projectDetails.location}</td>
        <td><strong>Date Issued:</strong></td><td>${today}</td>
      </tr>
      <tr>
        <td><strong>Preparing Engineer:</strong></td><td>${projectDetails.engineer ?? ''}</td>
        <td><strong>EIZ Reg. No.:</strong></td><td>${projectDetails.eiz_no ?? ''}</td>
      </tr>
    </table>
  </div>

  <p style="font-size:9pt;margin:12px 0"><strong>INSTRUCTIONS TO TENDERERS:</strong>
  Tenderers shall price each item in the Bills of Quantities. The rates and prices inserted shall be deemed to include all costs necessary to complete the works as described. Rates shall be in Zambian Kwacha (ZMW). The Grand Summary total shall be transferred to the Form of Tender. Any item not priced shall be deemed included in other rates.</p>

  ${billsHtml}

  <!-- GRAND SUMMARY -->
  <div class="page-break">
    <h3 class="bill-header">GRAND SUMMARY — COLLECTION OF BILLS</h3>
    <table>
      <thead>
        <tr><th>Bill</th><th>Description</th><th width="20%">Amount (ZMW)</th></tr>
      </thead>
      <tbody>
        ${summaryRows}
        <tr class="subtotal"><td colspan="2" class="right"><strong>SUB-TOTAL (exclusive of VAT)</strong></td><td class="right"><strong>${grandTotal.toLocaleString('en-ZM', { maximumFractionDigits: 2 })}</strong></td></tr>
        <tr><td colspan="2" class="right">VAT @ 16%</td><td class="right">${(grandTotal * 0.16).toLocaleString('en-ZM', { maximumFractionDigits: 2 })}</td></tr>
        <tr class="grand-total"><td colspan="2" class="right">GRAND TOTAL (inclusive of VAT)</td><td class="right">ZMW ${(grandTotal * 1.16).toLocaleString('en-ZM', { maximumFractionDigits: 2 })}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="declaration">
    <p><strong>TENDERER'S DECLARATION</strong></p>
    <p>I/We the undersigned, having examined the Invitation to Tender, Instructions to Tenderers, Conditions of Contract, Technical Specifications, Drawings and Bills of Quantities for the above-named contract, offer to execute and complete the works described therein for the sum of:</p>
    <p style="font-size:12pt;font-weight:bold;margin:12px 0">ZMW ______________________________________ (Amount in words: ________________________________________________)</p>
    <div class="sig-block">
      <div class="sig-line">Tenderer's Signature ________________________<br/>Name: _________________ Date: _____________<br/>Company: _________________________________<br/>ZPPA Reg. No.: _____________________________</div>
      <div class="sig-line">Witnessed by ______________________________<br/>Name: _________________ Date: _____________<br/>Title: ____________________________________<br/>Stamp:</div>
    </div>
  </div>

  <p style="font-size:8pt;color:#666;margin-top:16px;text-align:center">
    Generated by InFra_TeCh Engineering Platform — Quantities verified by engineering calculation.
    This BOQ must be certified by an EIZ-registered engineer before submission. Ref: ${projectDetails.contract_no ?? 'N/A'}.
  </p>
  <script>window.print();</script>
</body>
</html>`;
}
