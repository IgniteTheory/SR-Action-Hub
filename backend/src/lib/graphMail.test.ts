import { test, mock, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { ConfidentialClientApplication } from '@azure/msal-node';

// Generates a throwaway RSA key pair purely so graphMail's fs.readFileSync
// has a real PEM file to read — this is never the actual Microsoft
// certificate/key, just a locally-generated stand-in so the file-reading
// code path is exercised without any real secret existing anywhere.
const { privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
});
const keyPath = path.join(os.tmpdir(), `graph-mail-test-key-${process.pid}.pem`);

before(() => {
  fs.writeFileSync(keyPath, privateKey);
  process.env.MS_TENANT_ID = 'test-tenant-id';
  process.env.MS_CLIENT_ID = 'test-client-id';
  process.env.MS_SHARED_MAILBOX = 'ticketing@sraccounting.co.za';
  // A well-formed but entirely made-up thumbprint — the real one is a
  // production identifier that has no reason to live in test fixtures.
  process.env.MS_CERTIFICATE_THUMBPRINT = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  process.env.MS_CERTIFICATE_PRIVATE_KEY_PATH = keyPath;

  // Never let a test accidentally call the real Microsoft token endpoint.
  mock.method(ConfidentialClientApplication.prototype, 'acquireTokenByClientCredential', async () => ({
    accessToken: 'fake-test-token',
    expiresOn: new Date(Date.now() + 3600_000)
  }));
});

after(() => {
  fs.rmSync(keyPath, { force: true });
  mock.restoreAll();
});

test('graphMailIsConfigured returns false when a required env var is missing', async () => {
  const { graphMailIsConfigured } = await import('./graphMail');
  const saved = process.env.MS_SHARED_MAILBOX;
  delete process.env.MS_SHARED_MAILBOX;
  assert.equal(graphMailIsConfigured(), false);
  process.env.MS_SHARED_MAILBOX = saved;
});

test('graphMailIsConfigured returns true when every required env var is set', async () => {
  const { graphMailIsConfigured } = await import('./graphMail');
  assert.equal(graphMailIsConfigured(), true);
});

test('sendMailViaGraph posts to the fixed shared mailbox with the expected shape', async () => {
  const { sendMailViaGraph } = await import('./graphMail');
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;

  mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    capturedUrl = url;
    capturedInit = init;
    return new Response(null, { status: 202 });
  });

  await sendMailViaGraph({ to: 'client@example.com', subject: 'Hello', html: '<p>Hi</p>' });

  assert.match(capturedUrl, /^https:\/\/graph\.microsoft\.com\/v1\.0\/users\/ticketing%40sraccounting\.co\.za\/sendMail$/);
  assert.equal(capturedInit?.method, 'POST');
  assert.equal((capturedInit?.headers as Record<string, string>).Authorization, 'Bearer fake-test-token');
  const body = JSON.parse(capturedInit!.body as string);
  assert.equal(body.message.toRecipients[0].emailAddress.address, 'client@example.com');
  assert.equal(body.message.subject, 'Hello');
  assert.equal(body.message.body.contentType, 'HTML');
  assert.equal(body.saveToSentItems, true);

  mock.restoreAll();
  mock.method(ConfidentialClientApplication.prototype, 'acquireTokenByClientCredential', async () => ({
    accessToken: 'fake-test-token',
    expiresOn: new Date(Date.now() + 3600_000)
  }));
});

test('sendMailViaGraph retries once on 429 honouring Retry-After, then succeeds', async () => {
  const { sendMailViaGraph } = await import('./graphMail');
  let calls = 0;

  mock.method(globalThis, 'fetch', async () => {
    calls += 1;
    if (calls === 1) {
      return new Response(null, { status: 429, headers: { 'retry-after': '0' } });
    }
    return new Response(null, { status: 202 });
  });

  await sendMailViaGraph({ to: 'client@example.com', subject: 'Retry test', html: '<p>Hi</p>' });
  assert.equal(calls, 2);

  mock.restoreAll();
  mock.method(ConfidentialClientApplication.prototype, 'acquireTokenByClientCredential', async () => ({
    accessToken: 'fake-test-token',
    expiresOn: new Date(Date.now() + 3600_000)
  }));
});

test('sendMailViaGraph does not retry on 403 (permission error)', async () => {
  const { sendMailViaGraph } = await import('./graphMail');
  let calls = 0;

  mock.method(globalThis, 'fetch', async () => {
    calls += 1;
    return new Response(null, { status: 403 });
  });

  await assert.rejects(
    () => sendMailViaGraph({ to: 'client@example.com', subject: 'Denied', html: '<p>Hi</p>' }),
    /HTTP 403/
  );
  assert.equal(calls, 1, 'a 403 must fail immediately, not be retried as if transient');

  mock.restoreAll();
  mock.method(ConfidentialClientApplication.prototype, 'acquireTokenByClientCredential', async () => ({
    accessToken: 'fake-test-token',
    expiresOn: new Date(Date.now() + 3600_000)
  }));
});

test('readInboxMessages maps the Graph response into the app-facing shape', async () => {
  const { readInboxMessages } = await import('./graphMail');

  mock.method(globalThis, 'fetch', async (url: string) => {
    assert.match(url, /mailFolders\/inbox\/messages/);
    assert.match(url, /\$select=/);
    return new Response(
      JSON.stringify({
        value: [
          {
            id: 'msg-1',
            subject: 'Need help with VAT',
            from: { emailAddress: { address: 'jane@acmeco.example' } },
            receivedDateTime: '2026-08-04T10:00:00Z',
            conversationId: 'conv-1'
          }
        ]
      }),
      { status: 200 }
    );
  });

  const messages = await readInboxMessages(10);
  assert.equal(messages.length, 1);
  assert.deepEqual(messages[0], {
    id: 'msg-1',
    subject: 'Need help with VAT',
    from: 'jane@acmeco.example',
    receivedDateTime: '2026-08-04T10:00:00Z',
    conversationId: 'conv-1'
  });

  mock.restoreAll();
  mock.method(ConfidentialClientApplication.prototype, 'acquireTokenByClientCredential', async () => ({
    accessToken: 'fake-test-token',
    expiresOn: new Date(Date.now() + 3600_000)
  }));
});
