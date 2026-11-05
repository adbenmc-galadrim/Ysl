import 'fake-indexeddb/auto';
import { newId } from '@repo/shared/id';
import type { ScanReportV1 } from '@repo/contract/scan-report';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourrierDatabase } from '#/features/db/schema';
import { ORPHAN_GRACE_MS, sweepOrphanPhotos } from '#/features/photos/store';
import { reportMessage } from '#/features/scan-report/message';
import {
  ABANDONED,
  backoffAfter,
  enqueueReport,
  retryAfterMs,
  sendDueReports,
  type ReportPost,
} from '#/features/scan-report/outbox';
import { NOW, openTestDatabase } from './helpers/local-rows';
import { MemoryFiles } from './helpers/memory-files';

const T = NOW.getTime();

const outcomesDue = async (...args: Parameters<typeof sendDueReports>) =>
  (await sendDueReports(...args)).map(({ outcome }) => outcome);

const REPORT = { version: 1, shotAt: NOW.toISOString() } as ScanReportV1;

let db: CourrierDatabase;
let files: MemoryFiles;

beforeEach(async () => {
  db = await openTestDatabase();
  files = new MemoryFiles();
});

const queue = (comment = '') =>
  enqueueReport(
    db,
    files,
    {
      id: newId(),
      report: REPORT,
      comment,
      image: new Blob(['jpeg'], { type: 'image/jpeg' }),
      imageType: 'image/jpeg',
    },
    NOW,
  );

/** A server that answers each upload in turn, and keeps what it got. */
const server = (
  ...answers: (number | [number, string | null, string?] | Error)[]
) => {
  const got: FormData[] = [];
  const post: ReportPost = (body) => {
    got.push(body);
    const answer = answers.shift() ?? 201;
    if (answer instanceof Error) return Promise.reject(answer);
    const [status, retryAfter, error = null] =
      typeof answer === 'number' ? [answer, null] : answer;
    return Promise.resolve({ status, retryAfter, error });
  };
  return { post, got };
};

describe('enqueueReport', () => {
  it('keeps the image in OPFS beside the photos, the report in the row', async () => {
    const row = await queue('  Numéro faux ');
    expect(row.imagePath).toBe(`photos/report-${row.id}.jpg`);
    expect(row.image).toBeNull();
    expect(files.files.has(`report-${row.id}.jpg`)).toBe(true);
    expect(await db.scanReport.get(row.id)).toMatchObject({
      comment: 'Numéro faux',
      report: REPORT,
      attempts: 0,
    });
  });

  it('keeps the blob in the row where OPFS refuses it', async () => {
    files.failNextSave = true;
    const row = await queue();
    expect(row.imagePath).toBeNull();
    expect(row.image).toBeInstanceOf(Blob);
    expect(row.comment).toBeNull();
  });
});

describe('sendDueReports', () => {
  it('posts the four fields, then drops the row and the image', async () => {
    const row = await queue('Destinataire manquant');
    const { post, got } = server(201);

    expect(await outcomesDue(db, files, post, T)).toEqual(['sent']);

    const body = got[0]!;
    expect(body.get('id')).toBe(row.id);
    expect(JSON.parse(body.get('report') as string)).toEqual(REPORT);
    expect(body.get('comment')).toBe('Destinataire manquant');
    expect((body.get('image') as File).name).toBe(`report-${row.id}.jpg`);
    expect(await db.scanReport.count()).toBe(0);
    expect(files.files.size).toBe(0);
  });

  it('takes a resend answered 200 as sent', async () => {
    await queue();
    expect(await outcomesDue(db, files, server(200).post, T)).toEqual(['sent']);
    expect(await db.scanReport.count()).toBe(0);
  });

  it('drops the report when the feature is off, and says so', async () => {
    await queue();
    expect(await outcomesDue(db, files, server(404).post, T)).toEqual([
      'unavailable',
    ]);
    expect(await db.scanReport.count()).toBe(0);
    expect(files.files.size).toBe(0);
  });

  it.each([
    [400, 'invalid', 'Rapport refusé par le serveur (rapport illisible)'],
    [403, 'suspended', 'Rapport refusé par le serveur (compte suspendu)'],
    [413, 'too_large', 'Rapport refusé par le serveur (trop volumineux)'],
    [415, 'type', 'Rapport refusé par le serveur (image non reconnue)'],
  ])(
    'gives up on %i %s, says why and keeps the reason',
    async (status, error, said) => {
      const row = await queue();
      const settled = await sendDueReports(
        db,
        files,
        server([status, null, error]).post,
        T,
      );

      expect(settled).toEqual([{ outcome: 'refused', error }]);
      expect(reportMessage(settled[0]!)).toBe(said);
      expect(await db.scanReport.get(row.id)).toMatchObject({
        image: null,
        imagePath: null,
        nextAttemptAt: ABANDONED,
        lastError: `HTTP ${status} ${error}`,
      });
      expect(files.files.size).toBe(0);
      expect(
        await outcomesDue(db, files, server().post, T + 3_600_000),
      ).toEqual([]);
    },
  );

  it('says a refusal without a known reason as such', async () => {
    await queue();
    const [settled] = await sendDueReports(db, files, server(400).post, T);
    expect(settled).toEqual({ outcome: 'refused', error: null });
    expect(reportMessage(settled!)).toBe('Rapport refusé par le serveur');
  });

  it('keeps only the last report refused', async () => {
    const first = await queue();
    await sendDueReports(db, files, server(400).post, T);
    const second = await queue();
    await sendDueReports(db, files, server([413, null, 'too_large']).post, T);

    expect(await db.scanReport.get(first.id)).toBeUndefined();
    expect(await db.scanReport.get(second.id)).toMatchObject({
      lastError: 'HTTP 413 too_large',
    });
  });

  it('waits for a sign-in on 401, without counting an attempt', async () => {
    const row = await queue();
    await queue();
    const { post, got } = server(401);
    expect(await outcomesDue(db, files, post, T)).toEqual(['signed-out']);
    expect(got).toHaveLength(1);
    expect(await db.scanReport.get(row.id)).toMatchObject({
      attempts: 0,
      nextAttemptAt: T,
    });
  });

  it.each([429, 503])('waits as long as %i asks', async (status) => {
    const row = await queue();
    expect(
      await outcomesDue(db, files, server([status, '120']).post, T),
    ).toEqual(['later']);
    expect(await db.scanReport.get(row.id)).toMatchObject({
      attempts: 1,
      nextAttemptAt: T + 120_000,
      lastError: `HTTP ${status}`,
    });
    expect(await outcomesDue(db, files, server().post, T + 60_000)).toEqual([]);
    expect(await outcomesDue(db, files, server().post, T + 120_000)).toEqual([
      'sent',
    ]);
  });

  it('keeps the report offline or when the server is full, and backs off', async () => {
    const row = await queue();
    expect(
      await outcomesDue(db, files, server(new Error('offline')).post, T),
    ).toEqual(['later']);
    expect(await db.scanReport.get(row.id)).toMatchObject({
      attempts: 1,
      nextAttemptAt: T + backoffAfter(1),
    });
    const later = T + backoffAfter(1);
    expect(await outcomesDue(db, files, server(507).post, later)).toEqual([
      'later',
    ]);
    expect(await db.scanReport.get(row.id)).toMatchObject({
      attempts: 2,
      nextAttemptAt: later + backoffAfter(2),
    });
    expect(files.files.size).toBe(1);
  });

  it('sends a report kept without OPFS', async () => {
    files.failNextSave = true;
    await queue();
    const { post, got } = server(201);
    expect(await outcomesDue(db, files, post, T)).toEqual(['sent']);
    expect(await (got[0]!.get('image') as File).text()).toBe('jpeg');
  });

  /* The WebKit fault itself (an OPFS file sent as an empty body) needs a browser: replayed in WebKit Playwright, see docs/rapports-scan.md. */
  it('posts the bytes of the OPFS image, read before the upload', async () => {
    const row = await queue();
    const stored = files.files.get(`report-${row.id}.jpg`)!.blob;
    const read = vi.spyOn(stored, 'arrayBuffer');
    const { post, got } = server(201);

    await outcomesDue(db, files, post, T);
    const sent = got[0]!.get('image') as File;
    expect(read).toHaveBeenCalledOnce();
    expect(sent.type).toBe('image/jpeg');
    expect(await sent.text()).toBe('jpeg');
  });

  it.each([
    ['gone', () => undefined],
    ['read back empty', () => new Blob([])],
  ])(
    'says a report whose image is %s lost, without sending it',
    async (_, replace) => {
      const row = await queue();
      const name = `report-${row.id}.jpg`;
      const blob = replace();
      if (blob) files.files.set(name, { blob, lastModified: T });
      else files.files.delete(name);
      const { post, got } = server();

      const settled = await sendDueReports(db, files, post, T);
      expect(settled).toEqual([{ outcome: 'lost', error: null }]);
      expect(reportMessage(settled[0]!)).toBe(
        'Rapport perdu : image introuvable sur le téléphone',
      );
      expect(got).toHaveLength(0);
      expect(await db.scanReport.get(row.id)).toMatchObject({
        nextAttemptAt: ABANDONED,
        lastError: 'image missing on the phone',
      });
    },
  );
});

describe('retryAfterMs', () => {
  it('reads seconds and dates', () => {
    expect(retryAfterMs('30', T)).toBe(30_000);
    expect(retryAfterMs(new Date(T + 5_000).toUTCString(), T)).toBe(5_000);
    expect(retryAfterMs('soon', T)).toBeNull();
    expect(retryAfterMs(null, T)).toBeNull();
  });
});

describe('sweepOrphanPhotos', () => {
  it('leaves the image of a report still waiting', async () => {
    const row = await queue();
    files.files.get(`report-${row.id}.jpg`)!.lastModified =
      T - 2 * ORPHAN_GRACE_MS;
    expect(await sweepOrphanPhotos(db, files, NOW)).toEqual([]);
  });
});
