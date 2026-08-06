import fs from 'fs';
import { ConfidentialClientApplication, LogLevel } from '@azure/msal-node';

// App-only Microsoft Graph mailbox access for a single, fixed shared mailbox
// (ticketing@sraccounting.co.za in production). Certificate-based
// client-credentials auth only — never falls back to a client secret or a
// delegated/user token. See SECURITY_BOUNDARIES.md in the integration
// handoff for the authorization model this implements.
//
// Required env vars (see backend/.env.example):
//   MS_TENANT_ID, MS_CLIENT_ID, MS_SHARED_MAILBOX,
//   MS_CERTIFICATE_THUMBPRINT, MS_CERTIFICATE_PRIVATE_KEY_PATH
//
// The private key is read from a file path, never from an env var's value
// directly, so it can be supplied via the platform's protected secret-file
// mechanism instead of plaintext configuration.

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const GRAPH_SCOPE = 'https://graph.microsoft.com/.default';

export function graphMailIsConfigured(): boolean {
  return Boolean(
    process.env.MS_TENANT_ID &&
      process.env.MS_CLIENT_ID &&
      process.env.MS_SHARED_MAILBOX &&
      process.env.MS_CERTIFICATE_THUMBPRINT &&
      process.env.MS_CERTIFICATE_PRIVATE_KEY_PATH
  );
}

let cachedApp: ConfidentialClientApplication | null = null;

// A ConfidentialClientApplication instance owns MSAL's in-memory token
// cache, so building it once and reusing it is what makes repeated calls
// avoid re-requesting a token before the previous one expires — no manual
// expiry bookkeeping needed here.
function getMsalApp(): ConfidentialClientApplication {
  if (cachedApp) return cachedApp;

  const privateKeyPath = process.env.MS_CERTIFICATE_PRIVATE_KEY_PATH!;
  const privateKey = fs.readFileSync(privateKeyPath, 'utf8');

  cachedApp = new ConfidentialClientApplication({
    auth: {
      clientId: process.env.MS_CLIENT_ID!,
      authority: `https://login.microsoftonline.com/${process.env.MS_TENANT_ID}`,
      clientCertificate: {
        thumbprint: process.env.MS_CERTIFICATE_THUMBPRINT!,
        privateKey
      }
    },
    system: {
      loggerOptions: {
        // MSAL's own logger can be verbose at Info/Verbose; cap it at
        // Warning and route through console so nothing about the
        // certificate or token ever reaches stdout at normal levels.
        logLevel: LogLevel.Warning,
        loggerCallback: (level, message) => {
          if (level <= LogLevel.Warning) console.warn(`[graph-mail][msal] ${message}`);
        },
        piiLoggingEnabled: false
      }
    }
  });
  return cachedApp;
}

async function getAccessToken(): Promise<string> {
  const app = getMsalApp();
  const result = await app.acquireTokenByClientCredential({ scopes: [GRAPH_SCOPE] });
  if (!result?.accessToken) {
    throw new Error('Graph token acquisition returned no access token');
  }
  return result.accessToken;
}

interface RetryOptions {
  maxAttempts?: number;
  label: string;
}

// Bounded retry for transient Graph failures (429 + 5xx), honouring
// Retry-After when present. Never retries 4xx auth/permission errors
// (401/403/404) — those are configuration problems, not transient ones,
// and retrying them just delays surfacing a real error.
async function withGraphRetry<T>(fn: () => Promise<Response>, parse: (res: Response) => Promise<T>, opts: RetryOptions): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 4;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let res: Response;
    try {
      res = await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts) break;
      await sleep(backoffMs(attempt));
      continue;
    }

    if (res.status === 429 || res.status >= 500) {
      lastError = new Error(`Graph ${opts.label} failed: HTTP ${res.status}`);
      if (attempt === maxAttempts) break;
      const retryAfter = res.headers.get('retry-after');
      await sleep(retryAfter ? Number(retryAfter) * 1000 : backoffMs(attempt));
      continue;
    }

    if (!res.ok) {
      // Non-retryable (401/403/404/400/etc) — fail immediately with the
      // status but never the response body, which could echo back request
      // content including recipient/message details.
      throw new Error(`Graph ${opts.label} failed: HTTP ${res.status}`);
    }

    return parse(res);
  }

  throw lastError instanceof Error ? lastError : new Error(`Graph ${opts.label} failed after ${maxAttempts} attempts`);
}

function backoffMs(attempt: number): number {
  return Math.min(1000 * 2 ** (attempt - 1), 8000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface GraphSendMailInput {
  to: string;
  subject: string;
  html: string;
}

// POST /users/{mailbox}/sendMail — sends as the fixed shared mailbox this
// app is scoped to. The mailbox address is never taken from request input,
// only from MS_SHARED_MAILBOX, per SECURITY_BOUNDARIES.md ("fixed mailbox
// configuration rather than accepting arbitrary mailbox addresses").
export async function sendMailViaGraph(input: GraphSendMailInput): Promise<void> {
  const mailbox = process.env.MS_SHARED_MAILBOX!;
  const token = await getAccessToken();

  await withGraphRetry(
    () =>
      fetch(`${GRAPH_BASE}/users/${encodeURIComponent(mailbox)}/sendMail`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: {
            subject: input.subject,
            body: { contentType: 'HTML', content: input.html },
            toRecipients: [{ emailAddress: { address: input.to } }]
          },
          saveToSentItems: true
        })
      }),
    async () => undefined,
    { label: 'sendMail' }
  );

  console.log(`[graph-mail] sendMail succeeded (mailbox=${mailbox})`);
}

export interface GraphInboxMessage {
  id: string;
  subject: string;
  from: string | null;
  receivedDateTime: string;
  conversationId: string;
}

// GET /users/{mailbox}/mailFolders/inbox/messages — read-only, minimal
// field selection (no message body) to keep with "minimize stored email
// content" from SECURITY_BOUNDARIES.md. This is intentionally NOT wired
// into ticket creation yet: the business rules for which incoming emails
// should become tickets, how senders are matched, and how tickets get
// assigned are still open questions (see the discovery questionnaire, §5).
// This function exists so the Mail.Read grant is exercised and testable,
// per ACCEPTANCE_TESTS.md, ahead of that business logic being defined.
export async function readInboxMessages(top = 25): Promise<GraphInboxMessage[]> {
  const mailbox = process.env.MS_SHARED_MAILBOX!;
  const token = await getAccessToken();

  const select = 'id,subject,from,receivedDateTime,conversationId';
  const url = `${GRAPH_BASE}/users/${encodeURIComponent(mailbox)}/mailFolders/inbox/messages?$top=${top}&$select=${select}&$orderby=receivedDateTime desc`;

  const messages = await withGraphRetry(
    () => fetch(url, { headers: { Authorization: `Bearer ${token}` } }),
    async (res) => {
      const body = (await res.json()) as { value: Array<Record<string, unknown>> };
      return body.value;
    },
    { label: 'readInboxMessages' }
  );

  console.log(`[graph-mail] readInboxMessages succeeded (mailbox=${mailbox}, count=${messages.length})`);

  return messages.map((m) => ({
    id: String(m.id),
    subject: String(m.subject ?? ''),
    from: (m.from as { emailAddress?: { address?: string } } | undefined)?.emailAddress?.address ?? null,
    receivedDateTime: String(m.receivedDateTime),
    conversationId: String(m.conversationId)
  }));
}
