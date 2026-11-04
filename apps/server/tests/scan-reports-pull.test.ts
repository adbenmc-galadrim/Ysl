import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  ScanReportDetail,
  ScanReportImageType,
} from '@repo/contract/scan-report';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COMMENT_FILE,
  PullError,
  pullReports,
  REPORT_FILE,
  runHook,
  serverBase,
  watchReports,
  type Fetch,
  type WatchOptions,
} from '#ops/scan-reports-pull';
import { scanReportsRoute } from '#scan-reports-route';

const KEY = 'k'.repeat(32);
const SERVER = 'http://localhost:3101';
const FIRST = '0195f3a2-7b1c-7d4e-8f00-000000000001';
const SECOND = '0195f3a2-7b1c-7d4e-8f00-000000000002';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 4, 5, 6]);

type Stored = {
  detail: ScanReportDetail;
  image: Buffer;
};

function url(input: Parameters<Fetch>[0]): string {
  return input instanceof Request ? input.url : input.toString();
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function stored(
  id: string,
  {
    image = JPEG,
    imageType = 'image/jpeg',
    comment = 'Destinataire mal lu',
  }: {
    image?: Buffer;
    imageType?: ScanReportImageType;
    comment?: string | null;
  } = {},
): Stored {
  return {
    image,
    detail: {
      id,
      createdAt: '2026-11-04T10:00:00.000Z',
      imageType,
      imageBytes: image.length,
      organizationId: null,
      userId: 'agent-1',
      comment,
      imageSha256: sha256(image),
      report: { lectures: [{ moteur: 'factice', texte: '1Z 999' }] },
    },
  };
}

/** The real routes, over an in-memory store: what `reports:pull` talks to. */
function server(reports: Stored[], key: string | undefined = KEY) {
  const waiting = new Map(reports.map((report) => [report.detail.id, report]));
  const acknowledged: string[] = [];
  const route = scanReportsRoute({
    key,
    sender: () => Promise.resolve(null),
    store: {
      save: () => Promise.resolve('created'),
      list: () =>
        Promise.resolve(
          [...waiting.values()].map(({ detail }) => ({
            id: detail.id,
            createdAt: detail.createdAt,
            imageType: detail.imageType,
            imageBytes: detail.imageBytes,
          })),
        ),
      detail: (id) => Promise.resolve(waiting.get(id)?.detail ?? null),
      image: (id) => {
        const report = waiting.get(id);
        return Promise.resolve(
          report
            ? { bytes: report.image, contentType: report.detail.imageType }
            : null,
        );
      },
      acknowledge: (id) => {
        acknowledged.push(id);
        return Promise.resolve(waiting.delete(id));
      },
    },
  });
  const app = new Hono().route('/api/scan-reports', route);
  const fetchImpl = vi.fn<Fetch>((input, init) =>
    Promise.resolve(app.request(url(input), init)),
  );
  return { waiting, acknowledged, fetch: fetchImpl };
}

let dir: string;
const lines: string[] = [];

beforeEach(async () => {
  dir = join(await mkdtemp(join(tmpdir(), 'ysl-rapports-')), 'rapports-scan');
  lines.length = 0;
});

afterEach(async () => {
  await chmod(dir, 0o755).catch(() => undefined);
  await rm(join(dir, '..'), { recursive: true, force: true });
});

function options(fetchImpl: Fetch, overrides: Partial<WatchOptions> = {}) {
  return {
    server: SERVER,
    key: KEY,
    dir,
    fetch: fetchImpl,
    log: (line: string) => lines.push(line),
    ...overrides,
  };
}

describe('pulling the reports', () => {
  it('writes each report as received, then acknowledges it', async () => {
    const png = stored(SECOND, {
      image: PNG,
      imageType: 'image/png',
      comment: null,
    });
    const remote = server([stored(FIRST), png]);

    const result = await pullReports(options(remote.fetch));

    expect(result.failed).toEqual([]);
    expect(result.pulled.map((report) => report.id)).toEqual([FIRST, SECOND]);
    expect(remote.acknowledged).toEqual([FIRST, SECOND]);
    expect(remote.waiting.size).toBe(0);

    const first = join(dir, FIRST);
    expect((await readdir(first)).sort()).toEqual(
      [COMMENT_FILE, 'image.jpg', REPORT_FILE].sort(),
    );
    expect(
      JSON.parse(await readFile(join(first, REPORT_FILE), 'utf8')),
    ).toEqual(stored(FIRST).detail);
    expect(Buffer.compare(await readFile(join(first, 'image.jpg')), JPEG)).toBe(
      0,
    );
    expect(await readFile(join(first, COMMENT_FILE), 'utf8')).toBe(
      'Destinataire mal lu\n',
    );
    expect((await readdir(join(dir, SECOND))).sort()).toEqual(
      ['image.png', REPORT_FILE].sort(),
    );
    expect(await readdir(dir)).toEqual(
      expect.not.arrayContaining([expect.stringMatching(/^\./)]),
    );
  });

  it.skipIf(process.getuid?.() === 0)(
    'does not acknowledge a report it could not write',
    async () => {
      const remote = server([stored(FIRST)]);
      await mkdir(dir, { recursive: true });
      await chmod(dir, 0o555);

      const result = await pullReports(options(remote.fetch));

      expect(result.pulled).toEqual([]);
      expect(result.failed.map(({ id }) => id)).toEqual([FIRST]);
      expect(result.failed[0]?.reason).toMatch(/^écriture impossible/);
      expect(remote.acknowledged).toEqual([]);
      expect(remote.waiting.has(FIRST)).toBe(true);
      await chmod(dir, 0o755);
      expect(await readdir(dir)).toEqual([]);
    },
  );

  it('neither writes nor acknowledges an image that does not match its hash', async () => {
    const report = stored(FIRST);
    report.detail.imageSha256 = sha256(PNG);
    const remote = server([report]);

    const result = await pullReports(options(remote.fetch));

    expect(result.failed.map(({ id }) => id)).toEqual([FIRST]);
    expect(result.failed[0]?.reason).toMatch(/empreinte/);
    expect(remote.acknowledged).toEqual([]);
    expect(await readdir(dir)).toEqual([]);
  });

  it('only acknowledges a report a cut run had already written', async () => {
    const remote = server([stored(FIRST)]);
    await pullReports(options(remote.fetch));
    remote.waiting.set(FIRST, stored(FIRST));
    remote.fetch.mockClear();

    const result = await pullReports(options(remote.fetch));

    expect(result.pulled).toEqual([
      { id: FIRST, dir: join(dir, FIRST), written: false },
    ]);
    expect(remote.acknowledged).toEqual([FIRST, FIRST]);
    expect(await readdir(dir)).toEqual([FIRST]);
    const paths = remote.fetch.mock.calls.map(([input]) => url(input));
    expect(paths.some((path) => path.endsWith('/image'))).toBe(false);
  });

  it('never uses an identifier that is not a UUID as a path', async () => {
    const remote = server([stored('../../evil')]);

    const result = await pullReports(options(remote.fetch));

    expect(result.failed).toEqual([
      { id: '../../evil', reason: 'identifiant invalide' },
    ]);
    expect(remote.acknowledged).toEqual([]);
    expect(await readdir(join(dir, '..'))).toEqual(['rapports-scan']);
  });

  it('stops on a refused key, without ever printing it', async () => {
    const remote = server([stored(FIRST)], 'z'.repeat(32));

    const error = (await pullReports(options(remote.fetch)).then(
      () => null,
      (caught: unknown) => caught,
    )) as PullError;

    expect(error.message).toMatch(/401/);
    expect(error.fatal).toBe(true);
    expect(`${error.message}${lines.join('')}`).not.toContain(KEY);
  });

  it('says when the server has the reports switched off', async () => {
    const remote = server([stored(FIRST)], '');

    await expect(pullReports(options(remote.fetch))).rejects.toThrow(/404/);
  });
});

describe('the server address', () => {
  it('sends the key only over HTTPS, or to this machine', () => {
    expect(serverBase('https://ysl-api.shinseo.fr/')).toBe(
      'https://ysl-api.shinseo.fr',
    );
    expect(serverBase('http://127.0.0.1:3101')).toBe('http://127.0.0.1:3101');
    expect(() => serverBase('http://ysl-api.shinseo.fr')).toThrow(/HTTPS/);
  });
});

describe('the hook for the next reader', () => {
  it('runs once per acknowledged report, and its failure stops nothing', async () => {
    const remote = server([stored(FIRST), stored(SECOND)]);
    const onReport = vi.fn(() => Promise.reject(new Error('agent absent')));

    const result = await pullReports(options(remote.fetch, { onReport }));

    expect(onReport.mock.calls).toEqual([
      [{ id: FIRST, dir: join(dir, FIRST), written: true }],
      [{ id: SECOND, dir: join(dir, SECOND), written: true }],
    ]);
    expect(remote.acknowledged).toEqual([FIRST, SECOND]);
    expect(result.pulled).toHaveLength(2);
    expect(lines.filter((line) => line.includes('agent absent'))).toHaveLength(
      2,
    );
  });

  it('gives the command the report, never the key', async () => {
    vi.stubEnv('SCAN_REPORTS_KEY', KEY);
    const target = join(dir, FIRST);
    await mkdir(target, { recursive: true });

    await runHook(
      'printf "%s|%s|%s" "$SCAN_REPORT_ID" "$SCAN_REPORT_DIR" "${SCAN_REPORTS_KEY:-}" > "$SCAN_REPORT_DIR/accroche.txt"',
      { id: FIRST, dir: target, written: true },
    );
    vi.unstubAllEnvs();

    expect(await readFile(join(target, 'accroche.txt'), 'utf8')).toBe(
      `${FIRST}|${target}|`,
    );
    await expect(
      runHook('exit 3', { id: FIRST, dir: target, written: true }),
    ).rejects.toThrow(/code 3/);
  });
});

describe('watching', () => {
  /** Stops after `rounds` waits, and keeps them. */
  function sleeper(rounds: number, controller: AbortController) {
    const waits: number[] = [];
    const sleep = (ms: number) => {
      waits.push(ms);
      if (waits.length >= rounds) controller.abort();
      return Promise.resolve();
    };
    return { waits, sleep };
  }

  it('waits longer after each failure, at least what the server asks', async () => {
    const remote = server([stored(FIRST)]);
    const failures = [
      () =>
        Promise.resolve(
          new Response(JSON.stringify({ error: 'busy' }), {
            status: 503,
            headers: { 'Retry-After': '300' },
          }),
        ),
      () => Promise.reject(new TypeError('fetch failed')),
    ];
    const fetchImpl = vi.fn<Fetch>((input, init) =>
      (failures.shift() ?? (() => remote.fetch(input, init)))(),
    );
    const controller = new AbortController();
    const { waits, sleep } = sleeper(4, controller);

    await watchReports(
      options(fetchImpl, {
        signal: controller.signal,
        intervalMs: 60_000,
        sleep,
      }),
    );

    expect(waits).toEqual([300_000, 240_000, 60_000, 60_000]);
    expect(remote.acknowledged).toEqual([FIRST]);
    expect(lines.join('\n')).toMatch(/HTTP 503/);
  });

  it('never polls faster than every ten seconds', async () => {
    const remote = server([]);
    const controller = new AbortController();
    const { waits, sleep } = sleeper(1, controller);

    await watchReports(
      options(remote.fetch, {
        signal: controller.signal,
        intervalMs: 1,
        sleep,
      }),
    );

    expect(waits).toEqual([10_000]);
  });

  it('stops for good on a refused key', async () => {
    const remote = server([], 'z'.repeat(32));
    const controller = new AbortController();
    const { waits, sleep } = sleeper(5, controller);

    await expect(
      watchReports(options(remote.fetch, { signal: controller.signal, sleep })),
    ).rejects.toThrow(/401/);
    expect(waits).toEqual([]);
  });

  it('stops cleanly when interrupted while waiting', async () => {
    const remote = server([]);
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 20);

    await expect(
      watchReports(options(remote.fetch, { signal: controller.signal })),
    ).resolves.toBeUndefined();
  });
});
