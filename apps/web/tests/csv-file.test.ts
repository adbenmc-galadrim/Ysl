import { describe, expect, it } from 'vitest';
import { csvFile } from '#/features/exports/csv-file';

describe('csvFile', () => {
  const file = csvFile({
    filename: 'courrier-historique-2026-10-26.csv',
    csv: '﻿id;notes\r\n1;Laissé à l’accueil\r\n',
    count: 1,
  });

  it('keeps the name the server gave and says it is CSV', () => {
    expect(file.name).toBe('courrier-historique-2026-10-26.csv');
    expect(file.type).toBe('text/csv;charset=utf-8');
  });

  it('starts with the UTF-8 BOM Excel needs for the accents', async () => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes)).toContain('Laissé à l’accueil');
  });
});
