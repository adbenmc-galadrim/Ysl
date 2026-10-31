import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

type FakeDomain = { published: boolean; authenticated: boolean };

const record = (host_name: string, value: string, status: boolean) => ({
  type: 'TXT',
  host_name,
  value,
  status,
});

/**
 * Brevo's domain and sending API over real HTTP, on a local port. A domain
 * authenticates only once `publish` says its DNS records are in place.
 */
export async function startFakeBrevo() {
  const domains = new Map<string, FakeDomain>();
  const sent: {
    sender: { email: string; name: string };
    to: { email: string }[];
    subject: string;
    textContent: string;
    htmlContent?: string;
    replyTo?: { email: string };
    attachment?: { name: string; content: string }[];
    headers: { IdempotencyKey: string };
  }[] = [];
  /** Senders Brevo turns down, as after a domain's DNS was withdrawn. */
  const refusedSenders = new Set<string>();
  const server: Server = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
    req.on('end', () => {
      const reply = (status: number, body: unknown) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(body));
      };
      if (req.headers['api-key'] !== 'test-key') {
        reply(401, { code: 'unauthorized', message: 'Key not found' });
        return;
      }
      const url = req.url ?? '';
      if (url === '/v3/smtp/email') {
        const message = JSON.parse(raw) as (typeof sent)[number];
        if (refusedSenders.has(message.sender.email)) {
          reply(403, { code: 'permission_denied', message: 'sender' });
          return;
        }
        sent.push(message);
        reply(201, { messageId: `<${sent.length}@relay>` });
        return;
      }
      const name = decodeURIComponent(url.split('/')[4] ?? '');
      const domain = domains.get(name);
      if (req.method === 'POST') {
        const asked = (JSON.parse(raw) as { name: string }).name;
        if (!asked.includes('.') || asked.endsWith('.invalid')) {
          reply(400, { code: 'invalid_parameter', message: 'bad name' });
        } else if (domains.has(asked)) {
          reply(400, { code: 'invalid_parameter', message: 'already exists' });
        } else {
          domains.set(asked, { published: false, authenticated: false });
          reply(201, { id: domains.size, domain_name: asked });
        }
        return;
      }
      if (!domain) {
        reply(404, { code: 'document_not_found', message: 'unknown' });
        return;
      }
      if (req.method === 'DELETE') {
        domains.delete(name);
        res.writeHead(204).end();
      } else if (req.method === 'PUT') {
        if (!domain.published) {
          reply(400, { code: 'invalid_parameter', message: 'DNS not set' });
          return;
        }
        domain.authenticated = true;
        reply(200, { domain_name: name, message: 'authenticated' });
      } else {
        reply(200, {
          domain: name,
          verified: domain.published,
          authenticated: domain.authenticated,
          dns_records: {
            dkim_record: record(
              'mail._domainkey',
              'k=rsa;p=KEY',
              domain.published,
            ),
            brevo_code: record('@', 'brevo-code:1', domain.published),
            dmarc_record: record('_dmarc', 'v=DMARC1; p=none', false),
          },
        });
      }
    });
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address() as AddressInfo;
  const fetch: typeof globalThis.fetch = (input, init) =>
    globalThis.fetch(
      (input as string).replace(
        'https://api.brevo.com',
        `http://127.0.0.1:${port}`,
      ),
      init,
    );
  return {
    fetch,
    domains,
    sent,
    refusedSenders,
    publish: (name: string) => {
      const domain = domains.get(name);
      if (domain) domain.published = true;
    },
    close: () => new Promise((done) => server.close(done)),
  };
}
