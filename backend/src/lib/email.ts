import nodemailer from 'nodemailer';

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.office365.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false, // STARTTLS on 587, standard for Outlook/Office 365
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  return transporter;
}

export function emailIsConfigured(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

interface CompletionEmailInput {
  ticketNumber: string;
  clientName: string;
  contactName: string;
  contactEmail: string;
  description: string;
}

// Notifies a client that their request has been completed/handed over.
// Throws on failure — callers should catch and record the error rather than
// let a mail hiccup break the status-change request itself.
export async function sendCompletionEmail(input: CompletionEmailInput): Promise<void> {
  const t = getTransporter();
  if (!t) {
    throw new Error('Email is not configured yet (SMTP_USER / SMTP_PASS not set).');
  }

  const fromName = process.env.SMTP_FROM_NAME || 'SR Accounting';

  await t.sendMail({
    from: `"${fromName}" <${process.env.SMTP_USER}>`,
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
