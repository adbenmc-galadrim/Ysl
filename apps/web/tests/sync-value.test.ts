import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { describe, expect, it } from 'vitest';
import { syncCard } from '#/features/sync/sync-card';
import {
  showsPendingBanner,
  syncPill,
  syncValue,
} from '#/features/sync/sync-value';

const t = createTranslator(DEFAULT_LOCALE);

const view = (overrides = {}) => ({
  online: true,
  status: 'idle' as const,
  pending: 0,
  rejected: 0,
  lastSyncAt: new Date(2026, 9, 24, 11, 21),
  ...overrides,
});

describe('syncPill', () => {
  it('says offline before anything else, then a run in progress', () => {
    expect(syncPill(view({ online: false, status: 'syncing' }))).toBe(
      'offline',
    );
    expect(syncPill(view({ status: 'syncing' }))).toBe('syncing');
    expect(syncPill(view({ status: 'error' }))).toBe('synced');
    expect(syncPill(view({ status: 'error', pending: 2 }))).toBe('offline');
    expect(syncPill(view())).toBe('synced');
  });
});

describe('showsPendingBanner', () => {
  it('announces waiting changes only while the server is out of reach', () => {
    expect(showsPendingBanner(view({ pending: 2, online: false }))).toBe(true);
    expect(showsPendingBanner(view({ pending: 2, status: 'error' }))).toBe(
      true,
    );
    expect(showsPendingBanner(view({ pending: 2, status: 'syncing' }))).toBe(
      false,
    );
    expect(showsPendingBanner(view({ pending: 0, online: false }))).toBe(false);
  });
});

describe('syncValue', () => {
  it('ranks offline, running, waiting, failed, then up to date', () => {
    expect(syncValue(view({ online: false, pending: 3 }), t)).toEqual({
      label: 'Hors ligne',
      color: 'orange',
    });
    expect(syncValue(view({ status: 'syncing', pending: 3 }), t).label).toBe(
      'En cours…',
    );
    expect(syncValue(view({ pending: 3, status: 'error' }), t)).toEqual({
      label: '3 en attente',
      color: 'orange',
    });
    expect(syncValue(view({ rejected: 2 }), t)).toEqual({
      label: '2 à corriger',
      color: 'red',
    });
    expect(syncValue(view({ status: 'error' }), t)).toEqual({
      label: 'Échec',
      color: 'red',
    });
    expect(syncValue(view(), t)).toEqual({ label: 'À jour', color: 'green' });
  });
});

describe('syncCard', () => {
  it('shows the last time everything went through', () => {
    expect(syncCard(view(), t)).toEqual({
      state: 'synced',
      title: 'Tout est à jour',
      detail: 'Dernière synchronisation à 11 h 21',
    });
  });

  it('counts what is left to send, in the singular and the plural', () => {
    expect(syncCard(view({ pending: 1, online: false }), t)).toEqual({
      state: 'pending',
      title: '1 changement à envoyer',
      detail: 'Hors ligne, envoi au retour du réseau',
    });
    expect(syncCard(view({ pending: 3, status: 'error' }), t).title).toBe(
      '3 changements à envoyer',
    );
  });

  it('names refused changes when nothing else waits', () => {
    expect(syncCard(view({ rejected: 2 }), t)).toMatchObject({
      state: 'pending',
      title: '2 changements à corriger',
    });
  });

  it('says so when this iPhone never synchronised', () => {
    expect(syncCard(view({ lastSyncAt: null }), t).detail).toBe(
      'Jamais synchronisé sur cet iPhone',
    );
  });
});
