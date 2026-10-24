import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { describe, expect, it } from 'vitest';
import { derivePacks, type PrepInput } from '#/features/offline/packs';

const t = createTranslator(DEFAULT_LOCALE);

const ready = (): PrepInput => ({
  directory: { online: true, status: 'idle', hasCursor: true, persons: 312 },
  models: {
    state: 'done',
    progress: { bytes: 42e6, total: 42e6, files: 6, filesDone: 6 },
  },
  shell: { state: 'done', bytes: 6e6 },
});

const rows = (input: PrepInput) =>
  derivePacks(input, t).downloads.map(({ pack, state, progress }) => [
    pack.title,
    pack.detail,
    state,
    Math.round(progress * 100),
  ]);

describe('derivePacks', () => {
  it('says what is on the device once everything landed', () => {
    const view = derivePacks(ready(), t);
    expect(rows(ready())).toEqual([
      ['Annuaire', '312 personnes', 'done', 100],
      ['Lecture des étiquettes', '42 Mo', 'done', 100],
      ['Écrans et polices', '6 Mo', 'done', 100],
    ]);
    expect(view).toMatchObject({
      allDone: true,
      paused: false,
      remainingBytes: null,
    });
  });

  it('shows the reader in bytes while it downloads, and what is left', () => {
    const input = ready();
    input.models = {
      state: 'running',
      progress: { bytes: 18e6, total: 42e6, files: 6, filesDone: 2 },
    };
    const view = derivePacks(input, t);
    expect(rows(input)[1]).toEqual([
      'Lecture des étiquettes',
      '18 Mo sur 42 Mo',
      'running',
      43,
    ]);
    expect(view).toMatchObject({
      allDone: false,
      paused: false,
      remainingBytes: 24e6,
    });
  });

  it('counts files when the sizes are unknown', () => {
    const input = ready();
    input.models = {
      state: 'running',
      progress: { bytes: 5e6, total: null, files: 6, filesDone: 3 },
    };
    expect(rows(input)[1]).toEqual([
      'Lecture des étiquettes',
      '3 fichiers sur 6',
      'running',
      50,
    ]);
    expect(derivePacks(input, t).remainingBytes).toBeNull();
  });

  it('marks a stopped download as paused and keeps the bar where it was', () => {
    const input = ready();
    input.models = {
      state: 'paused',
      progress: { bytes: 18e6, total: 42e6, files: 6, filesDone: 2 },
    };
    expect(rows(input)[1]).toEqual([
      'Lecture des étiquettes',
      '18 Mo sur 42 Mo, en pause',
      'paused',
      43,
    ]);
    expect(derivePacks(input, t).paused).toBe(true);
  });

  it('pauses the directory offline or after a failed pull, until the cursor lands', () => {
    const input = ready();
    input.directory = {
      online: true,
      status: 'syncing',
      hasCursor: false,
      persons: 40,
    };
    expect(rows(input)[0]).toEqual([
      'Annuaire',
      'Téléchargement…',
      'running',
      0,
    ]);
    input.directory.status = 'error';
    expect(rows(input)[0]?.[2]).toBe('paused');
    input.directory = {
      online: false,
      status: 'idle',
      hasCursor: false,
      persons: 0,
    };
    expect(rows(input)[0]).toEqual([
      'Annuaire',
      'Téléchargement…, en pause',
      'paused',
      0,
    ]);
    input.directory = {
      online: false,
      status: 'idle',
      hasCursor: true,
      persons: 1,
    };
    expect(rows(input)[0]).toEqual(['Annuaire', '1 personne', 'done', 100]);
  });

  it('keeps Continue off while the shell installs', () => {
    const input = ready();
    input.shell = { state: 'running', bytes: null };
    expect(rows(input)[2]).toEqual([
      'Écrans et polices',
      'Installation…',
      'running',
      0,
    ]);
    expect(derivePacks(input, t).allDone).toBe(false);
    input.shell = { state: 'done', bytes: null };
    expect(rows(input)[2]?.[1]).toBe('Installés');
  });
});
