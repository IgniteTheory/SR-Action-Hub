import type { Action } from '../api/types';
import { formatCurrency } from './format';

// Mirrors the plain-text bodies in backend/src/lib/email.ts so a manually
// copied/pasted email reads identically to what an automatic send would
// have produced. Kept here (not fetched from the backend) so copying is
// instant with no round trip.
const FROM_NAME = 'SR Accounting';

export interface EmailDraft {
  subject: string;
  body: string;
}

export function buildQuoteEmail(action: Action, quoteLink: string): EmailDraft {
  const amountLine = action.quoteAmount ? `Quoted amount: ${formatCurrency(action.quoteAmount)}\n` : '';
  return {
    subject: `Quote for your review — ${action.ticketNumber}`,
    body:
      `Hi ${action.contactPerson},\n\n` +
      `Please find a quote for the following request:\n\n` +
      `${action.description}\n\n` +
      amountLine +
      `Reference: ${action.ticketNumber}\n\n` +
      `Please review and accept or decline here:\n${quoteLink}\n\n` +
      `Kind regards,\n${FROM_NAME}`
  };
}

export function buildCompletionEmail(action: Action): EmailDraft {
  return {
    subject: `Your request has been completed — ${action.ticketNumber}`,
    body:
      `Hi ${action.contactPerson},\n\n` +
      `We've completed your request:\n\n` +
      `${action.description}\n\n` +
      `Reference: ${action.ticketNumber}\n\n` +
      `If you have any questions, just reply to this email.\n\n` +
      `Kind regards,\n${FROM_NAME}`
  };
}

export function buildAcknowledgementEmail(action: Action): EmailDraft {
  const expectedByFormatted = new Date(action.dueAt).toLocaleString('en-ZA', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  return {
    subject: `We've received your request — ${action.ticketNumber}`,
    body:
      `Hi ${action.contactPerson},\n\n` +
      `We've received your request and it's now with our team:\n\n` +
      `${action.description}\n\n` +
      `Expected by: ${expectedByFormatted}\n` +
      `Reference: ${action.ticketNumber}\n\n` +
      `If you have any questions, just reply to this email.\n\n` +
      `Kind regards,\n${FROM_NAME}`
  };
}

export function mailtoLink(to: string, draft: EmailDraft): string {
  const params = new URLSearchParams({ subject: draft.subject, body: draft.body });
  return `mailto:${encodeURIComponent(to)}?${params.toString()}`;
}
