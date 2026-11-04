import { isWebhookAuthorized, type SaveOutcome } from '@repo/api';
import {
  SCAN_REPORT_BODY_MAX_BYTES,
  SCAN_REPORT_COMMENT_MAX_LENGTH,
  SCAN_REPORT_FIELDS,
  SCAN_REPORT_IMAGE_MAX_BYTES,
  SCAN_REPORT_JSON_MAX_BYTES,
  SCAN_REPORT_RATE,
  SCAN_REPORT_UPLOADS_AT_ONCE,
  scanReportBody,
  scanReportId,
  type ScanReportBody,
  type ScanReportDetail,
  type ScanReportError,
  type ScanReportImageType,
  type ScanReportUploaded,
  type ScanReportSummary,
} from '@repo/contract/scan-report';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';

export type ReportSender = { userId: string; organizationId: string | null };

export type ScanReportStore = {
  save: (report: {
    id: string;
    userId: string;
    organizationId: string | null;
    report: ScanReportBody;
    comment: string | null;
    image: Buffer;
  }) => Promise<SaveOutcome>;
  list: () => Promise<ScanReportSummary[]>;
  detail: (id: string) => Promise<ScanReportDetail | null>;
  image: (
    id: string,
  ) => Promise<{ bytes: Buffer; contentType: ScanReportImageType } | null>;
  acknowledge: (id: string) => Promise<boolean>;
};

export type ScanReportsRouteOptions = {
  /** The PC's key; without it every route answers 404: nobody would fetch. */
  key: string | undefined;
  /** The signed-in account sending, `suspended` when it or its company is. */
  sender: (headers: Headers) => Promise<ReportSender | 'suspended' | null>;
  store: ScanReportStore;
  now?: () => number;
};

/** At most `max` calls per key in any `windowMs`; kept in memory, one instance. */
export function slidingWindow({
  max,
  windowMs,
  now = Date.now,
}: {
  max: number;
  windowMs: number;
  now?: () => number;
}): (key: string) => boolean {
  const calls = new Map<string, number[]>();
  return (key) => {
    const at = now();
    for (const [other, times] of calls) {
      const kept = times.filter((time) => at - time < windowMs);
      if (kept.length === 0) calls.delete(other);
      else calls.set(other, kept);
    }
    const times = calls.get(key) ?? [];
    if (times.length >= max) return false;
    calls.set(key, [...times, at]);
    return true;
  };
}

const NO_STORE = { 'Cache-Control': 'no-store' };

function refuse(
  c: Context,
  status: 400 | 401 | 403 | 413 | 415 | 429 | 503 | 507,
  error: ScanReportError,
  headers: Record<string, string> = {},
) {
  return c.json({ error }, status, { ...NO_STORE, ...headers });
}

const SAVED = {
  created: 201,
  duplicate: 200,
  type: 415,
  full: 507,
} as const satisfies Record<SaveOutcome, number>;

/**
 * The scan reports of the test phase (D32). The phone sends with its session;
 * Adam's PC lists, downloads and acknowledges with the operation's key, which
 * no company account holds. Nothing here is reachable from an admin screen.
 */
export function scanReportsRoute({
  key,
  sender,
  store,
  now,
}: ScanReportsRouteOptions): Hono {
  const route = new Hono();
  const allow = slidingWindow({ ...SCAN_REPORT_RATE, now });

  route.use('*', async (c, next) => {
    if (!key) return c.body(null, 404);
    await next();
  });

  const receive = async (c: Context, from: ReportSender) => {
    const form = await c.req.parseBody().catch(() => null);
    if (!form) return refuse(c, 400, 'invalid');
    const id = scanReportId.safeParse(form[SCAN_REPORT_FIELDS.id]);
    const text = form[SCAN_REPORT_FIELDS.report];
    const comment = form[SCAN_REPORT_FIELDS.comment] ?? '';
    const image = form[SCAN_REPORT_FIELDS.image];
    if (
      !id.success ||
      typeof text !== 'string' ||
      typeof comment !== 'string' ||
      !(image instanceof File)
    ) {
      return refuse(c, 400, 'invalid');
    }
    if (
      Buffer.byteLength(text) > SCAN_REPORT_JSON_MAX_BYTES ||
      image.size > SCAN_REPORT_IMAGE_MAX_BYTES
    ) {
      return refuse(c, 413, 'too_large');
    }
    // Postgres refuses the NUL character in `text` and `jsonb`: a 400, not a 500.
    if (
      comment.length > SCAN_REPORT_COMMENT_MAX_LENGTH ||
      comment.includes('\0') ||
      /\\u0000/i.test(text)
    ) {
      return refuse(c, 400, 'invalid');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return refuse(c, 400, 'invalid');
    }
    const report = scanReportBody.safeParse(parsed);
    if (!report.success) return refuse(c, 400, 'invalid');

    const outcome = await store.save({
      id: id.data,
      userId: from.userId,
      organizationId: from.organizationId,
      report: report.data,
      comment: comment.trim() || null,
      image: Buffer.from(await image.arrayBuffer()),
    });
    if (outcome === 'type' || outcome === 'full') {
      return refuse(c, SAVED[outcome], outcome);
    }
    const uploaded: ScanReportUploaded = { id: id.data };
    return c.json(uploaded, SAVED[outcome], NO_STORE);
  };

  let reading = 0;
  route.post(
    '/',
    bodyLimit({
      maxSize: SCAN_REPORT_BODY_MAX_BYTES,
      onError: (c) => refuse(c, 413, 'too_large'),
    }),
    async (c) => {
      const from = await sender(c.req.raw.headers);
      if (!from) return refuse(c, 401, 'unauthorized');
      if (from === 'suspended') {
        return refuse(c, 403, 'suspended');
      }
      if (!allow(from.userId)) {
        return refuse(c, 429, 'rate_limited', {
          'Retry-After': String(SCAN_REPORT_RATE.windowMs / 1000),
        });
      }
      // The VPS has no swap: a few images in memory at a time, whoever sends them.
      if (reading >= SCAN_REPORT_UPLOADS_AT_ONCE) {
        return refuse(c, 503, 'busy', { 'Retry-After': '30' });
      }
      reading += 1;
      try {
        return await receive(c, from);
      } finally {
        reading -= 1;
      }
    },
  );

  const pc = new Hono();
  pc.use('*', async (c, next) => {
    // `key` is set: the 404 above answered otherwise.
    if (!isWebhookAuthorized(c.req.header('authorization'), key!)) {
      return c.body(null, 401);
    }
    await next();
  });
  const reportId = (c: Context) => {
    const id = scanReportId.safeParse(c.req.param('id'));
    return id.success ? id.data : null;
  };

  pc.get('/', async (c) => c.json(await store.list(), 200, NO_STORE));

  pc.get('/:id', async (c) => {
    const id = reportId(c);
    const found = id ? await store.detail(id) : null;
    return found ? c.json(found, 200, NO_STORE) : c.body(null, 404);
  });

  pc.get('/:id/image', async (c) => {
    const id = reportId(c);
    const file = id ? await store.image(id) : null;
    if (!file) return c.body(null, 404);
    return c.body(new Uint8Array(file.bytes), 200, {
      ...NO_STORE,
      'Content-Type': file.contentType,
      'Content-Disposition': 'attachment',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'X-Content-Type-Options': 'nosniff',
    });
  });

  pc.post('/:id/ack', async (c) => {
    const id = reportId(c);
    const gone = id ? await store.acknowledge(id) : false;
    return c.body(null, gone ? 204 : 404);
  });

  route.route('/', pc);
  return route;
}
