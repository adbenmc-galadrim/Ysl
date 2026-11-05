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
import { v1Report } from './fixture';

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
  it('reads a v1 report: image, comment, every text', async () => {
    const dir = await pulled(
      detail(
        v1Report(
          { recipient: 'Nom Fictif' },
          {
            ocr: {
              state: 'done',
              engine: 'paddle',
              width: 1200,
              height: 1600,
              sourceWidth: 1200,
              sourceHeight: 1600,
              input: { maxSide: 1600, quality: 0.8 },
              timings: {},
              lines: [
                {
                  text: '12 rue Inventée',
                  box: { x: 0, y: 0, width: 10, height: 10 },
                  score: 0.9,
                },
              ],
            },
          },
        ),
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

  it('reads a report sent from the review, the codes it kept as personal', async () => {
    const report = await readReport(
      ID,
      await pulled(
        detail(
          v1Report(
            {},
            {
              origin: 'revue',
              shot: null,
              ocr: { state: 'kept' },
              missing: ['frame', 'shot', 'decodePasses'],
              kept: {
                from: 'draft',
                readAt: '2026-11-04T09:12:03.000Z',
                rules: null,
                codes: [{ format: 'Code128', text: 'CODE-FICTIF-0042' }],
                ocrLines: [
                  {
                    text: '12 RUE DE L EXEMPLE',
                    box: { x: 10, y: 20, width: 300, height: 18 },
                    score: 0.93,
                  },
                ],
                ocrText: '12 RUE DE L EXEMPLE',
                durations: { codesMs: 95, ocrMs: 900, fusionMs: null },
              },
            },
          ),
        ),
      ),
    );
    expect(report.personal).toContain('CODE-FICTIF-0042');
    expect(report.texts).toContain('12 RUE DE L EXEMPLE');
  });

  it('keys a report by its tracking, hashed, and by its image', async () => {
    const dir = await pulled(detail(v1Report({ tracking: 'XY111222333FR' })));
    const keys = labelKeys(await readReport(ID, dir));
    expect(keys).toEqual([
      `tracking:${sha256('XY111222333FR')}`,
      `image:${sha256(IMAGE)}`,
    ]);
    expect(keys.join()).not.toContain('XY111222333FR');
  });

  it('refuses another id or an image that does not match its hash', async () => {
    const other = await pulled(detail(v1Report(), { id: 'autre' }));
    await expect(readReport(ID, other)).rejects.toThrow(ReportError);
    const tampered = await pulled(
      detail(v1Report()),
      Buffer.from('autre image'),
    );
    await expect(readReport(ID, tampered)).rejects.toThrow(/empreinte/);
  });

  it('refuses a version it does not know, or a v1 that breaks the contract', async () => {
    const v2 = await pulled(detail({ ...v1Report(), version: 2 }));
    await expect(readReport(ID, v2)).rejects.toThrow(
      'version du rapport inconnue (2, attendue 1)',
    );
    const none = await pulled(detail({ fields: {} }));
    await expect(readReport(ID, none)).rejects.toThrow(
      'version du rapport inconnue (absente, attendue 1)',
    );
    const broken = { ...v1Report() } as Record<string, unknown>;
    delete broken.codes;
    await expect(readReport(ID, await pulled(detail(broken)))).rejects.toThrow(
      /rapport v1 non conforme \(codes/,
    );
  });
});
