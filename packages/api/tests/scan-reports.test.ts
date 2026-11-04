import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import { SCAN_REPORT_PENDING_MAX_BYTES } from '@repo/contract/scan-report';
import * as schema from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runPurge } from '#features/maintenance/purge';
import {
  acknowledgeScanReport,
  listScanReports,
  saveScanReport,
  scanImageType,
  scanReportDetail,
  scanReportImage,
} from '#features/scan-reports/service';
import {
  AGENT_ID,
  asAnyDb,
  openTestDb,
  ORGANIZATION_ID,
  type TestDb,
} from './helpers/pglite';

let client: PGlite;
let db: TestDb;

beforeAll(async () => {
  ({ client, db } = await openTestDb());
}, 60_000);

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await db.delete(schema.scanReport);
});

const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.from('synthetic image'),
]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-04T10:00:00.000Z');

function report(overrides: Partial<Parameters<typeof saveScanReport>[1]> = {}) {
  return {
    id: newId(),
    userId: AGENT_ID,
    organizationId: ORGANIZATION_ID,
    report: { readers: [{ kind: 'code128', raw: '1Z0000000000000000' }] },
    comment: 'Destinataire mal lu',
    image: JPEG,
    ...overrides,
  };
}

describe('an uploaded report', () => {
  it('knows the image by its bytes', () => {
    expect(scanImageType(JPEG)).toBe('image/jpeg');
    expect(scanImageType(PNG)).toBe('image/png');
    expect(scanImageType(Buffer.from('<svg></svg>'))).toBeNull();
  });

  it('is kept once, even sent twice', async () => {
    const sent = report();

    expect(await saveScanReport(asAnyDb(db), sent)).toBe('created');
    expect(
      await saveScanReport(asAnyDb(db), { ...sent, comment: 'renvoi' }),
    ).toBe('duplicate');

    const rows = await db.select().from(schema.scanReport);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.comment).toBe('Destinataire mal lu');
  });

  it('is refused when it is not an image', async () => {
    expect(
      await saveScanReport(
        asAnyDb(db),
        report({ image: Buffer.from('<svg onload="x"/>') }),
      ),
    ).toBe('type');
    expect(await db.select().from(schema.scanReport)).toHaveLength(0);
  });

  it('is refused once the server holds enough, a resend still answered', async () => {
    const waiting = report();
    await db.insert(schema.scanReport).values({
      ...waiting,
      imageType: 'image/jpeg',
      imageBytes: SCAN_REPORT_PENDING_MAX_BYTES,
      imageSha256: 'x',
    });

    expect(await saveScanReport(asAnyDb(db), report())).toBe('full');
    expect(await saveScanReport(asAnyDb(db), waiting)).toBe('duplicate');
  });
});

describe('what the PC fetches', () => {
  it('lists the waiting reports oldest first, without images', async () => {
    const older = report({ now: new Date(NOW.getTime() - DAY) });
    const newer = report({ now: NOW, image: PNG });
    await saveScanReport(asAnyDb(db), newer);
    await saveScanReport(asAnyDb(db), older);

    expect(await listScanReports(asAnyDb(db))).toEqual([
      {
        id: older.id,
        createdAt: '2026-11-03T10:00:00.000Z',
        imageType: 'image/jpeg',
        imageBytes: JPEG.length,
      },
      {
        id: newer.id,
        createdAt: '2026-11-04T10:00:00.000Z',
        imageType: 'image/png',
        imageBytes: PNG.length,
      },
    ]);
  });

  it('downloads everything, nothing masked, and the image as sent', async () => {
    const sent = report({ now: NOW });
    await saveScanReport(asAnyDb(db), sent);

    expect(await scanReportDetail(asAnyDb(db), sent.id)).toEqual({
      id: sent.id,
      createdAt: NOW.toISOString(),
      organizationId: ORGANIZATION_ID,
      userId: AGENT_ID,
      comment: 'Destinataire mal lu',
      report: sent.report,
      imageType: 'image/jpeg',
      imageBytes: JPEG.length,
      imageSha256: createHash('sha256').update(JPEG).digest('hex'),
    });
    const image = await scanReportImage(asAnyDb(db), sent.id);
    expect(image?.contentType).toBe('image/jpeg');
    expect(Buffer.compare(image!.bytes, JPEG)).toBe(0);
  });

  it('leaves nothing on the server once acknowledged', async () => {
    const sent = report();
    await saveScanReport(asAnyDb(db), sent);

    expect(await acknowledgeScanReport(asAnyDb(db), sent.id)).toBe(true);
    expect(await acknowledgeScanReport(asAnyDb(db), sent.id)).toBe(false);
    expect(await scanReportDetail(asAnyDb(db), sent.id)).toBeNull();
    expect(await scanReportImage(asAnyDb(db), sent.id)).toBeNull();
  });
});

describe('the scheduled purge', () => {
  it('deletes what nobody fetched in 14 days, and keeps the rest', async () => {
    const stale = report({ now: new Date(NOW.getTime() - 14 * DAY - 1000) });
    const recent = report({ now: new Date(NOW.getTime() - 13 * DAY) });
    await saveScanReport(asAnyDb(db), stale);
    await saveScanReport(asAnyDb(db), recent);

    await runPurge(asAnyDb(db), { now: NOW, trigger: 'auto' });

    expect((await listScanReports(asAnyDb(db))).map((row) => row.id)).toEqual([
      recent.id,
    ]);
  });
});

describe('the admin screens (D26)', () => {
  const features = fileURLToPath(new URL('../src/features', import.meta.url));
  const allowed = new Set(['scan-reports/service.ts', 'maintenance/purge.ts']);

  it('read no report: only the PC routes and the purge do', () => {
    const readers = readdirSync(features, { recursive: true })
      .map(String)
      .filter((file) => file.endsWith('.ts') && !allowed.has(file))
      .filter((file) =>
        /scanReport|scan_report|scan-reports/.test(
          readFileSync(`${features}/${file}`, 'utf8'),
        ),
      );
    expect(readers).toEqual([]);
  });
});
