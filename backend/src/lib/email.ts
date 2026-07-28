import nodemailer from 'nodemailer';
import dns from 'dns';

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

// nodemailer resolves both A and AAAA records for the SMTP host and then
// picks a RANDOM address from the combined list to connect to (see
// formatDNSValue in nodemailer/lib/shared) rather than always preferring
// IPv4. Render's containers don't have a working IPv6 route out, so
// whenever it randomly picks one of Office 365's AAAA addresses the
// connection fails with ENETUNREACH. We resolve the A record ourselves —
// via dns.lookup(), the same OS-level resolution every other outbound
// connection in this app already relies on, rather than nodemailer's
// dns.resolve4()/resolve6() (a separate raw-DNS code path that isn't
// guaranteed to work the same way inside a hosting platform's network) —
// and connect to that IP literal (with servername set for correct
// TLS/SNI) so nodemailer never gets a chance to pick an IPv6 address.
// Bounded with a timeout so a slow/broken resolution can never hang the
// request that triggered the email (e.g. ticket creation) — a failure
// here should only ever cost this one email, recorded as an error.
let cachedIp: { host: string; address: string; expires: number } | null = null;

async function resolveIPv4(host: string): Promise<string> {
  if (cachedIp && cachedIp.host === host && cachedIp.expires > Date.now()) {
    return cachedIp.address;
  }
  const { address } = await withTimeout(dns.promises.lookup(host, { family: 4 }), 4000, 'DNS lookup');
  cachedIp = { host, address, expires: Date.now() + 5 * 60 * 1000 };
  return address;
}

async function getTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  const host = process.env.SMTP_HOST || 'smtp.office365.com';
  const ip = await resolveIPv4(host);
  return nodemailer.createTransport({
    host: ip,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false, // STARTTLS on 587, standard for Outlook/Office 365
    tls: { servername: host }, // keep TLS validating against the real hostname, not the IP
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

export function emailIsConfigured(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
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
async function send(args: SendArgs): Promise<void> {
  const t = await getTransporter();
  if (!t) {
    throw new Error('Email is not configured yet (SMTP_USER / SMTP_PASS not set).');
  }
  const fromName = process.env.SMTP_FROM_NAME || 'SR Accounting';
  await t.sendMail({
    from: `"${fromName}" <${process.env.SMTP_USER}>`,
    to: args.to,
    subject: args.subject,
    text: args.text,
    html: args.html
  });
}

interface CompletionEmailInput {
  ticketNumber: string;
  contactName: string;
  contactEmail: string;
  description: string;
}

export async function sendCompletionEmail(input: CompletionEmailInput): Promise<void> {
  const fromName = process.env.SMTP_FROM_NAME || 'SR Accounting';
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
  const fromName = process.env.SMTP_FROM_NAME || 'SR Accounting';
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
  const fromName = process.env.SMTP_FROM_NAME || 'SR Accounting';
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
