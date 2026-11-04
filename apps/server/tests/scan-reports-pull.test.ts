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
  serverBase,
  type Fetch,
  type PullOptions,
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

function options(fetchImpl: Fetch, overrides: Partial<PullOptions> = {}) {
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
