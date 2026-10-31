import type { PGlite } from '@electric-sql/pglite';
import * as schema from '@repo/db/schema';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  inspectLogo,
  logoFile,
  removeLogo,
  saveLogo,
} from '#features/company/logo';
import {
  readCompanySettings,
  writeCompanySettings,
} from '#features/company/settings';
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
  await db.delete(schema.companyLogo);
  await db.delete(schema.setting);
});

const PNG_HEAD = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function png(width: number, height: number): Buffer {
  const header = Buffer.alloc(16);
  header.writeUInt32BE(13, 0);
  header.write('IHDR', 4, 'latin1');
  header.writeUInt32BE(width, 8);
  header.writeUInt32BE(height, 12);
  return Buffer.concat([PNG_HEAD, header]);
}

describe('the logo', () => {
  it('reads what the file really is', () => {
    expect(inspectLogo(png(512, 512))).toEqual({
      contentType: 'image/png',
      width: 512,
      height: 512,
    });
    const jpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11,
      0x08, 0x01, 0x00, 0x02, 0x00, 0x03,
    ]);
    expect(inspectLogo(jpeg)).toEqual({
      contentType: 'image/jpeg',
      width: 512,
      height: 256,
    });
  });

  it('refuses an SVG, a renamed file, a file too heavy or too large', () => {
    expect(
      inspectLogo(
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'),
      ),
    ).toBe('type');
    expect(inspectLogo(Buffer.from('GIF89a...........'))).toBe('type');
    expect(inspectLogo(PNG_HEAD)).toBe('type');
    expect(
      inspectLogo(Buffer.concat([png(64, 64), Buffer.alloc(600 * 1024)])),
    ).toBe('size');
    expect(inspectLogo(png(30000, 30000))).toBe('dimensions');
    expect(inspectLogo(png(1, 1))).toBe('dimensions');
  });

  it('gives a new address at each upload and leaves none behind', async () => {
    const anyDb = asAnyDb(db);
    const first = await saveLogo(anyDb, ORGANIZATION_ID, png(64, 64), AGENT_ID);
    const second = await saveLogo(
      anyDb,
      ORGANIZATION_ID,
      png(128, 128),
      AGENT_ID,
    );
    if (typeof first === 'string' || typeof second === 'string') {
      throw new Error('refused');
    }
    expect(second.logoId).not.toBe(first.logoId);
    expect(await logoFile(anyDb, first.logoId)).toBeNull();
    expect(await logoFile(anyDb, second.logoId)).toMatchObject({
      contentType: 'image/png',
    });
    expect((await readCompanySettings(anyDb, ORGANIZATION_ID)).logoId).toBe(
      second.logoId,
    );

    await removeLogo(anyDb, ORGANIZATION_ID, AGENT_ID);

    expect(await logoFile(anyDb, second.logoId)).toBeNull();
    expect(
      (await readCompanySettings(anyDb, ORGANIZATION_ID)).logoId,
    ).toBeNull();
  });

  it('does not touch the other settings of the company', async () => {
    const anyDb = asAnyDb(db);
    await writeCompanySettings(
      anyDb,
      ORGANIZATION_ID,
      { retention: { parcel: 6 } },
      AGENT_ID,
    );
    await saveLogo(anyDb, ORGANIZATION_ID, png(64, 64), AGENT_ID);
    expect(
      (await readCompanySettings(anyDb, ORGANIZATION_ID)).retention,
    ).toEqual({ parcel: 6 });
  });
});
