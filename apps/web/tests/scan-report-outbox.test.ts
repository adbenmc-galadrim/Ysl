import 'fake-indexeddb/auto';
import { newId } from '@repo/shared/id';
import type { ScanReportV1 } from '@repo/contract/scan-report';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CourrierDatabase } from '#/features/db/schema';
import { ORPHAN_GRACE_MS, sweepOrphanPhotos } from '#/features/photos/store';
import {
  backoffAfter,
  enqueueReport,
  retryAfterMs,
  sendDueReports,
  type ReportPost,
} from '#/features/scan-report/outbox';
import { NOW, openTestDatabase } from './helpers/local-rows';
import { MemoryFiles } from './helpers/memory-files';

const T = NOW.getTime();

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
const server = (...answers: (number | [number, string] | Error)[]) => {
  const got: FormData[] = [];
  const post: ReportPost = (body) => {
    got.push(body);
    const answer = answers.shift() ?? 201;
    if (answer instanceof Error) return Promise.reject(answer);
    const [status, retryAfter] =
      typeof answer === 'number' ? [answer, null] : answer;
    return Promise.resolve({ status, retryAfter });
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

    expect(await sendDueReports(db, files, post, T)).toEqual(['sent']);

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
    expect(await sendDueReports(db, files, server(200).post, T)).toEqual([
      'sent',
    ]);
    expect(await db.scanReport.count()).toBe(0);
  });

  it('drops the report when the feature is off, and says so', async () => {
    await queue();
    expect(await sendDueReports(db, files, server(404).post, T)).toEqual([
      'unavailable',
    ]);
    expect(await db.scanReport.count()).toBe(0);
    expect(files.files.size).toBe(0);
  });

  it.each([400, 403, 413, 415])('gives up on %i', async (status) => {
    await queue();
    expect(await sendDueReports(db, files, server(status).post, T)).toEqual([
      'refused',
    ]);
    expect(await db.scanReport.count()).toBe(0);
  });

  it('waits for a sign-in on 401, without counting an attempt', async () => {
    const row = await queue();
    await queue();
    const { post, got } = server(401);
    expect(await sendDueReports(db, files, post, T)).toEqual(['signed-out']);
    expect(got).toHaveLength(1);
    expect(await db.scanReport.get(row.id)).toMatchObject({
      attempts: 0,
      nextAttemptAt: T,
    });
  });

  it.each([429, 503])('waits as long as %i asks', async (status) => {
    const row = await queue();
    expect(
      await sendDueReports(db, files, server([status, '120']).post, T),
    ).toEqual(['later']);
    expect(await db.scanReport.get(row.id)).toMatchObject({
      attempts: 1,
      nextAttemptAt: T + 120_000,
      lastError: `HTTP ${status}`,
    });
    expect(await sendDueReports(db, files, server().post, T + 60_000)).toEqual(
      [],
    );
    expect(await sendDueReports(db, files, server().post, T + 120_000)).toEqual(
      ['sent'],
    );
  });

  it('keeps the report offline or when the server is full, and backs off', async () => {
    const row = await queue();
    expect(
      await sendDueReports(db, files, server(new Error('offline')).post, T),
    ).toEqual(['later']);
    expect(await db.scanReport.get(row.id)).toMatchObject({
      attempts: 1,
      nextAttemptAt: T + backoffAfter(1),
    });
    const later = T + backoffAfter(1);
    expect(await sendDueReports(db, files, server(507).post, later)).toEqual([
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
    expect(await sendDueReports(db, files, post, T)).toEqual(['sent']);
    expect(await (got[0]!.get('image') as File).text()).toBe('jpeg');
  });

  it('drops a report whose image is gone', async () => {
    const row = await queue();
    files.files.delete(`report-${row.id}.jpg`);
    const { post, got } = server();
    expect(await sendDueReports(db, files, post, T)).toEqual(['refused']);
    expect(got).toHaveLength(0);
  });
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
