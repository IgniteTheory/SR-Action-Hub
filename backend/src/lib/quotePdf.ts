import PDFDocument from 'pdfkit';
import type { Prisma } from '@prisma/client';

type ActionForQuote = Prisma.ActionGetPayload<{ include: { client: true; requestType: true } }>;

function formatRand(amount: Prisma.Decimal | null): string {
  if (amount == null) return 'To be confirmed';
  return `R ${Number(amount).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Renders a simple, self-contained quote document — no fabricated company
// registration/VAT/banking details, since we don't hold real ones for SR
// Accounting here. Staff download this and send it however they choose;
// the automatic quote-link email flow is separate and unaffected.
export function renderQuotePdf(action: ActionForQuote): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: 56 });

  doc.fontSize(20).font('Helvetica-Bold').text('SR Accounting');
  doc.fontSize(11).font('Helvetica').fillColor('#555').text('Quote');
  doc.moveDown(1.5);
  doc.fillColor('#000');

  const issued = new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });

  const row = (label: string, value: string) => {
    doc.font('Helvetica-Bold').fontSize(10).text(label, { continued: true });
    doc.font('Helvetica').text(`  ${value}`);
  };

  row('Reference:', action.ticketNumber);
  row('Date issued:', issued);
  row('Client:', action.client.name);
  row('Contact:', action.contactPerson);
  row('Request type:', action.requestType.name);
  doc.moveDown(1);

  doc.font('Helvetica-Bold').fontSize(11).text('Description of work');
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(10.5).text(action.quoteDescription ?? '', { width: 480 });
  doc.moveDown(1.5);

  doc.font('Helvetica-Bold').fontSize(11).text('Quoted amount');
  doc.moveDown(0.3);
  doc.font('Helvetica-Bold').fontSize(18).text(formatRand(action.quoteAmount));
  doc.moveDown(2);

  doc.font('Helvetica').fontSize(9).fillColor('#777').text(
    `Generated from SR Action Hub on ${issued}. Please contact SR Accounting with any questions about this quote.`,
    { width: 480 }
  );

  doc.end();
  return doc;
}
