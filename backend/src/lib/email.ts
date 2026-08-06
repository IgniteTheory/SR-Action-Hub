import { graphMailIsConfigured, sendMailViaGraph } from './graphMail';

// Outbound email now goes through Microsoft Graph (sendMail as the fixed
// ticketing@sraccounting.co.za shared mailbox — see graphMail.ts), replacing
// the previous Office 365 SMTP/app-password integration. This file's job is
// unchanged: build the three transactional email bodies and hand them to a
// single send() call, so callers in actions.ts need no changes.

export function emailIsConfigured(): boolean {
  return graphMailIsConfigured();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface SendArgs {
  to: string;
  subject: string;
  text: string;
  html: string;
}

// Throws on failure — callers should catch and record the error rather than
// let a mail hiccup break the request that triggered it.
//
// `text` is accepted for call-site compatibility with the existing template
// functions below but is not sent separately: Graph's sendMail takes a
// single body content type per message, so the HTML body is what's sent
// (matching what most email clients render anyway). This is a minor
// behavior change from the old SMTP path, which sent a true
// multipart/alternative text+HTML message.
async function send(args: SendArgs): Promise<void> {
  if (!graphMailIsConfigured()) {
    throw new Error(
      'Email is not configured yet (MS_TENANT_ID / MS_CLIENT_ID / MS_SHARED_MAILBOX / ' +
        'MS_CERTIFICATE_THUMBPRINT / MS_CERTIFICATE_PRIVATE_KEY_PATH not all set).'
    );
  }
  await sendMailViaGraph({ to: args.to, subject: args.subject, html: args.html });
}

interface CompletionEmailInput {
  ticketNumber: string;
  contactName: string;
  contactEmail: string;
  description: string;
}

export async function sendCompletionEmail(input: CompletionEmailInput): Promise<void> {
  const fromName = process.env.MAIL_FROM_NAME || 'SR Accounting';
  await send({
    to: input.contactEmail,
    subject: `Your request has been completed — ${input.ticketNumber}`,
    text:
      `Hi ${input.contactName},\n\n` +
      `We've completed your request:\n\n` +
      `${input.description}\n\n` +
      `Reference: ${input.ticketNumber}\n\n` +
      `If you have any questions, just reply to this email.\n\n` +
      `Kind regards,\n${fromName}`,
    html:
      `<p>Hi ${escapeHtml(input.contactName)},</p>` +
      `<p>We've completed your request:</p>` +
      `<p>${escapeHtml(input.description)}</p>` +
      `<p style="color:#6b7570;font-size:13px;">Reference: ${escapeHtml(input.ticketNumber)}</p>` +
      `<p>If you have any questions, just reply to this email.</p>` +
      `<p>Kind regards,<br/>${escapeHtml(fromName)}</p>`
  });
}

interface AcknowledgementEmailInput {
  ticketNumber: string;
  contactName: string;
  contactEmail: string;
  description: string;
  expectedByFormatted: string; // e.g. "27 July 2026, 17:00" — formatted by the caller
}

export async function sendAcknowledgementEmail(input: AcknowledgementEmailInput): Promise<void> {
  const fromName = process.env.MAIL_FROM_NAME || 'SR Accounting';
  await send({
    to: input.contactEmail,
    subject: `We've received your request — ${input.ticketNumber}`,
    text:
      `Hi ${input.contactName},\n\n` +
      `We've received your request and it's now with our team:\n\n` +
      `${input.description}\n\n` +
      `Expected by: ${input.expectedByFormatted}\n` +
      `Reference: ${input.ticketNumber}\n\n` +
      `If you have any questions, just reply to this email.\n\n` +
      `Kind regards,\n${fromName}`,
    html:
      `<p>Hi ${escapeHtml(input.contactName)},</p>` +
      `<p>We've received your request and it's now with our team:</p>` +
      `<p>${escapeHtml(input.description)}</p>` +
      `<p><b>Expected by:</b> ${escapeHtml(input.expectedByFormatted)}</p>` +
      `<p style="color:#6b7570;font-size:13px;">Reference: ${escapeHtml(input.ticketNumber)}</p>` +
      `<p>If you have any questions, just reply to this email.</p>` +
      `<p>Kind regards,<br/>${escapeHtml(fromName)}</p>`
  });
}

interface QuoteEmailInput {
  ticketNumber: string;
  contactName: string;
  contactEmail: string;
  description: string;
  quoteAmount: string | null; // preformatted currency, e.g. "R 900.00"
  quoteLink: string;
}

export async function sendQuoteEmail(input: QuoteEmailInput): Promise<void> {
  const fromName = process.env.MAIL_FROM_NAME || 'SR Accounting';
  const amountLine = input.quoteAmount ? `Quoted amount: ${input.quoteAmount}\n` : '';
  const amountHtml = input.quoteAmount ? `<p><b>Quoted amount:</b> ${escapeHtml(input.quoteAmount)}</p>` : '';

  await send({
    to: input.contactEmail,
    subject: `Quote for your review — ${input.ticketNumber}`,
    text:
      `Hi ${input.contactName},\n\n` +
      `Please find a quote for the following request:\n\n` +
      `${input.description}\n\n` +
      amountLine +
      `Reference: ${input.ticketNumber}\n\n` +
      `Please review and accept or decline here:\n${input.quoteLink}\n\n` +
      `Kind regards,\n${fromName}`,
    html:
      `<p>Hi ${escapeHtml(input.contactName)},</p>` +
      `<p>Please find a quote for the following request:</p>` +
      `<p>${escapeHtml(input.description)}</p>` +
      amountHtml +
      `<p style="color:#6b7570;font-size:13px;">Reference: ${escapeHtml(input.ticketNumber)}</p>` +
      `<p><a href="${input.quoteLink}" style="display:inline-block;background:#1f7a4d;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;">Review &amp; Respond to Quote</a></p>` +
      `<p>Kind regards,<br/>${escapeHtml(fromName)}</p>`
  });
}
