import {
  SCAN_REPORT_BODY_MAX_BYTES,
  SCAN_REPORT_IMAGE_MAX_BYTES,
  SCAN_REPORT_RATE,
  type ScanReportDetail,
} from '@repo/contract/scan-report';
import { describe, expect, it, vi } from 'vitest';
import {
  scanReportsRoute,
  type ReportSender,
  type ScanReportsRouteOptions,
  type ScanReportStore,
} from '#scan-reports-route';

const KEY = 'k'.repeat(32);
const ID = '0195f3a2-7b1c-7d4e-8f00-000000000001';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const AGENT: ReportSender = { userId: 'agent-1', organizationId: null };

type Saved = Parameters<ScanReportStore['save']>[0];
type Sender = ScanReportsRouteOptions['sender'];

function memoryStore() {
  const saved = new Map<string, Saved>();
  const save = vi.fn((report: Saved) => {
    if (report.image[0] !== 0xff) return Promise.resolve('type' as const);
    if (saved.has(report.id)) return Promise.resolve('duplicate' as const);
    saved.set(report.id, report);
    return Promise.resolve('created' as const);
  });
  const store: ScanReportStore = {
    save,
    list: () =>
      Promise.resolve(
        [...saved.values()].map((report) => ({
          id: report.id,
          createdAt: '2026-11-04T10:00:00.000Z',
          imageType: 'image/jpeg' as const,
          imageBytes: report.image.length,
        })),
      ),
    detail: (id) => {
      const report = saved.get(id);
      if (!report) return Promise.resolve(null);
      return Promise.resolve({
        id,
        createdAt: '2026-11-04T10:00:00.000Z',
        organizationId: report.organizationId,
        userId: report.userId,
        comment: report.comment,
        report: report.report,
        imageType: 'image/jpeg',
        imageBytes: report.image.length,
        imageSha256: 'sha',
      } satisfies ScanReportDetail);
    },
    image: (id) => {
      const report = saved.get(id);
      return Promise.resolve(
        report ? { bytes: report.image, contentType: 'image/jpeg' } : null,
      );
    },
    acknowledge: (id) => Promise.resolve(saved.delete(id)),
  };
  return { saved, save, store };
}

function app({
  key = KEY,
  sender = vi.fn<Sender>(() => Promise.resolve(AGENT)),
  now = (): number => 0,
}: {
  key?: string;
  sender?: ReturnType<typeof vi.fn<Sender>>;
  now?: () => number;
} = {}) {
  const { saved, save, store } = memoryStore();
  return {
    saved,
    save,
    sender,
    route: scanReportsRoute({ key, sender, store, now }),
  };
}

function form({
  id = ID,
  report = '{"readers":[{"kind":"code128","raw":"1Z"}]}',
  comment = '  Destinataire mal lu ',
  image = JPEG,
}: {
  id?: string;
  report?: string;
  comment?: string;
  image?: Buffer | null;
} = {}) {
  const body = new FormData();
  body.set('id', id);
  body.set('report', report);
  body.set('comment', comment);
  if (image) {
    body.set('image', new Blob([new Uint8Array(image)]), 'image.jpg');
  }
  return body;
}

function send(route: ReturnType<typeof app>['route'], body = form()) {
  return route.request('/', { method: 'POST', body });
}

function pc(
  route: ReturnType<typeof app>['route'],
  path: string,
  { method = 'GET', key = KEY } = {},
) {
  return route.request(path, {
    method,
    headers: key ? { authorization: `Bearer ${key}` } : {},
  });
}

describe('sending a report', () => {
  it('keeps it once from a signed-in account, everything as sent', async () => {
    const { route, saved } = app();

    const first = await send(route);
    expect(first.status).toBe(201);
    expect(await first.json()).toEqual({ id: ID });
    expect((await send(route)).status).toBe(200);

    const report = saved.get(ID)!;
    expect(report).toMatchObject({
      userId: 'agent-1',
      organizationId: null,
      comment: 'Destinataire mal lu',
      report: { readers: [{ kind: 'code128', raw: '1Z' }] },
    });
    expect(Buffer.compare(report.image, JPEG)).toBe(0);
  });

  it('refuses an account that is not signed in, or suspended', async () => {
    const signedOut = app({
      sender: vi.fn<Sender>(() => Promise.resolve(null)),
    });
    expect((await send(signedOut.route)).status).toBe(401);
    expect(signedOut.save).not.toHaveBeenCalled();

    const suspended = app({
      sender: vi.fn<Sender>(() => Promise.resolve('suspended')),
    });
    expect((await send(suspended.route)).status).toBe(403);
    expect(suspended.save).not.toHaveBeenCalled();
  });

  it('refuses an image over the limit', async () => {
    const { route, save } = app();
    const response = await send(
      route,
      form({ image: Buffer.alloc(SCAN_REPORT_IMAGE_MAX_BYTES + 1, 0xff) }),
    );

    expect(response.status).toBe(413);
    expect(save).not.toHaveBeenCalled();
  });

  it('refuses a body announced too long before reading anything', async () => {
    const { route, sender } = app();
    const response = await route.request('/', {
      method: 'POST',
      headers: {
        'content-type': 'multipart/form-data; boundary=x',
        'content-length': String(SCAN_REPORT_BODY_MAX_BYTES + 1),
      },
      body: 'x',
    });

    expect(response.status).toBe(413);
    expect(sender).not.toHaveBeenCalled();
  });

  it('refuses a file that is not an image', async () => {
    const { route } = app();
    const response = await send(route, form({ image: Buffer.from('<svg/>') }));

    expect(response.status).toBe(415);
  });

  it.each([
    ['without an id', form({ id: 'abc' })],
    ['with readings that are not JSON', form({ report: '{' })],
    ['with readings that are not an object', form({ report: '[1]' })],
    ['without an image', form({ image: null })],
    ['with a comment too long', form({ comment: 'a'.repeat(2001) })],
    [
      'with a NUL Postgres refuses, in the readings',
      form({ report: '{"raw":"a\\u0000b"}' }),
    ],
    ['with a NUL Postgres refuses, in the comment', form({ comment: 'a\0b' })],
  ])('refuses a report %s', async (_, body) => {
    const { route, save } = app();

    expect((await send(route, body)).status).toBe(400);
    expect(save).not.toHaveBeenCalled();
  });

  it('slows down an account sending too many, not the others', async () => {
    let now = 0;
    const sender = vi.fn<Sender>((headers) =>
      Promise.resolve({
        userId: headers.get('x-user') ?? 'agent-1',
        organizationId: null,
      }),
    );
    const { route } = app({ sender, now: () => now });
    const from = (user: string, index: number) =>
      route.request('/', {
        method: 'POST',
        headers: { 'x-user': user },
        body: form({
          id: `0195f3a2-7b1c-7d4e-8f00-${String(index).padStart(12, '0')}`,
        }),
      });

    for (let index = 0; index < SCAN_REPORT_RATE.max; index += 1) {
      expect((await from('agent-1', index)).status).toBe(201);
    }
    const refused = await from('agent-1', 100);
    expect(refused.status).toBe(429);
    expect(refused.headers.get('retry-after')).toBe('600');
    expect((await from('agent-2', 101)).status).toBe(201);

    now = SCAN_REPORT_RATE.windowMs;
    expect((await from('agent-1', 102)).status).toBe(201);
  });

  it('reads two uploads at a time, all accounts together', async () => {
    const { route, save } = app();
    let release = () => undefined as void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    save.mockImplementation(async () => {
      await held;
      return 'created';
    });
    const id = (n: number) => `0195f3a2-7b1c-7d4e-8f00-00000000010${n}`;

    const first = send(route, form({ id: id(1) }));
    const second = send(route, form({ id: id(2) }));
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    const third = await send(route, form({ id: id(3) }));
    expect(third.status).toBe(503);
    expect(third.headers.get('retry-after')).toBe('30');

    release();
    expect((await first).status).toBe(201);
    expect((await second).status).toBe(201);
    expect((await send(route, form({ id: id(4) }))).status).toBe(201);
  });

  it('is off without the key, like everything here', async () => {
    const { route, sender } = app({ key: '' });

    expect((await send(route)).status).toBe(404);
    expect((await pc(route, '/')).status).toBe(404);
    expect(sender).not.toHaveBeenCalled();
  });
});

describe("Adam's PC", () => {
  it.each([
    ['missing', ''],
    ['wrong', 'w'.repeat(32)],
    ['of another length', `${KEY}k`],
  ])('is refused with a key %s', async (_, key) => {
    const { route } = app();
    await send(route);

    for (const [method, path] of [
      ['GET', '/'],
      ['GET', `/${ID}`],
      ['GET', `/${ID}/image`],
      ['POST', `/${ID}/ack`],
    ] as const) {
      expect((await pc(route, path, { method, key })).status).toBe(401);
    }
  });

  it('lists, downloads, then acknowledges: nothing is left', async () => {
    const { route, saved } = app();
    await send(route);

    const list = await pc(route, '/');
    expect(list.status).toBe(200);
    expect(list.headers.get('cache-control')).toBe('no-store');
    expect(await list.json()).toEqual([
      expect.objectContaining({ id: ID, imageBytes: JPEG.length }),
    ]);

    const detail = await pc(route, `/${ID}`);
    expect(await detail.json()).toMatchObject({
      id: ID,
      comment: 'Destinataire mal lu',
      report: { readers: [{ kind: 'code128', raw: '1Z' }] },
    });

    const image = await pc(route, `/${ID}/image`);
    expect(image.headers.get('content-type')).toBe('image/jpeg');
    expect(image.headers.get('x-content-type-options')).toBe('nosniff');
    expect(image.headers.get('content-disposition')).toBe('attachment');
    expect(Buffer.from(await image.arrayBuffer())).toEqual(JPEG);

    expect((await pc(route, `/${ID}/ack`, { method: 'POST' })).status).toBe(
      204,
    );
    expect(saved.size).toBe(0);
    expect((await pc(route, `/${ID}/ack`, { method: 'POST' })).status).toBe(
      404,
    );
    expect((await pc(route, `/${ID}`)).status).toBe(404);
  });

  it('finds nothing at an address that is not a report id', async () => {
    const { route } = app();

    expect((await pc(route, '/abc')).status).toBe(404);
    expect((await pc(route, '/abc/image')).status).toBe(404);
    expect((await pc(route, '/abc/ack', { method: 'POST' })).status).toBe(404);
  });
});
