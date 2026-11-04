import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  labelKeys,
  readReport,
  ReportError,
  sha256,
  trackingOf,
} from '#report';

const ID = '0b5e1c3a-7d2f-4e8b-9a61-2f4c8d0e6b17';
const IMAGE = Buffer.from('fausse image jpeg');

async function pulled(detail: Record<string, unknown>, image = IMAGE) {
  const dir = await mkdtemp(join(tmpdir(), 'scan-agent-'));
  await writeFile(join(dir, 'rapport.json'), JSON.stringify(detail));
  await writeFile(join(dir, 'image.jpg'), image);
  return dir;
}

const detail = (report: unknown, extra: Record<string, unknown> = {}) => ({
  id: ID,
  imageType: 'image/jpeg',
  imageSha256: sha256(IMAGE),
  report,
  comment: null,
  ...extra,
});

describe('trackingOf', () => {
  it('prefers the tracking the user typed over the one read', () => {
    expect(
      trackingOf({
        fields: { tracking: { value: 'XY 111 222 333 FR' } },
        corrections: [
          { field: 'recipient', value: 'Nom Fictif' },
          { field: 'tracking', value: '1z 999 aa1 01 2345 6784', how: 'typed' },
        ],
      }),
    ).toBe('1Z999AA10123456784');
  });

  it('falls back on the field read, then on the draft', () => {
    expect(
      trackingOf({ fields: { tracking: { value: 'XY111222333FR' } } }),
    ).toBe('XY111222333FR');
    expect(trackingOf({ draft: { tracking: '6A12345678901' } })).toBe(
      '6A12345678901',
    );
  });

  it('gives nothing on a report without a usable tracking', () => {
    expect(trackingOf(undefined)).toBeNull();
    expect(trackingOf({ fields: { tracking: { value: null } } })).toBeNull();
    expect(trackingOf({ fields: { tracking: { value: '12' } } })).toBeNull();
  });
});

describe('readReport', () => {
  it('reads a minimal report: image, comment, every text', async () => {
    const dir = await pulled(
      detail(
        {
          fields: { recipient: { value: 'Nom Fictif' } },
          ocr: { lines: [{ text: '12 rue Inventée' }] },
        },
        { comment: 'mauvais destinataire' },
      ),
    );
    const report = await readReport(ID, dir);
    expect(report.imageExt).toBe('jpg');
    expect(report.tracking).toBeNull();
    expect(report.texts).toEqual(
      expect.arrayContaining([
        'Nom Fictif',
        '12 rue Inventée',
        'mauvais destinataire',
      ]),
    );
    expect(labelKeys(report)).toEqual([`image:${sha256(IMAGE)}`]);
  });

  it('keys a report by its tracking, hashed, and by its image', async () => {
    const dir = await pulled(
      detail({ fields: { tracking: { value: 'XY111222333FR' } } }),
    );
    const keys = labelKeys(await readReport(ID, dir));
    expect(keys).toEqual([
      `tracking:${sha256('XY111222333FR')}`,
      `image:${sha256(IMAGE)}`,
    ]);
    expect(keys.join()).not.toContain('XY111222333FR');
  });

  it('refuses another id or an image that does not match its hash', async () => {
    const other = await pulled(detail({}, { id: 'autre' }));
    await expect(readReport(ID, other)).rejects.toThrow(ReportError);
    const tampered = await pulled(detail({}), Buffer.from('autre image'));
    await expect(readReport(ID, tampered)).rejects.toThrow(/empreinte/);
  });
});
