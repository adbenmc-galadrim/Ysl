import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { describe, expect, it } from 'vitest';
import { syncCard } from '#/features/sync/sync-card';
import {
  pendingBanner,
  showsPendingBanner,
  syncAlert,
  syncPill,
  syncValue,
} from '#/features/sync/sync-value';

const t = createTranslator(DEFAULT_LOCALE);

const view = (overrides = {}) => ({
  online: true,
  status: 'idle' as const,
  pending: 0,
  rejected: 0,
  oldestAt: null as Date | null,
  lastSyncAt: new Date(2026, 9, 24, 11, 21),
  ...overrides,
});

const NOW = new Date(2026, 9, 24, 12, 0);
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000);
const stale = (overrides = {}) =>
  view({ pending: 3, oldestAt: hoursAgo(25), ...overrides });

describe('syncAlert', () => {
  it('fires once a waiting change is a day old, refused or not', () => {
    expect(syncAlert(view(), NOW)).toBe(false);
    expect(syncAlert(view({ pending: 3, oldestAt: hoursAgo(23) }), NOW)).toBe(
      false,
    );
    expect(syncAlert(stale(), NOW)).toBe(true);
    expect(syncAlert(view({ rejected: 1, oldestAt: hoursAgo(48) }), NOW)).toBe(
      true,
    );
  });
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

  it('stays up online once the changes are a day old', () => {
    expect(showsPendingBanner(stale(), NOW)).toBe(true);
    expect(showsPendingBanner(stale({ status: 'syncing' }), NOW)).toBe(true);
  });
});

describe('pendingBanner', () => {
  it('turns red and asks for the export after a day, orange before', () => {
    expect(pendingBanner(view({ pending: 2, online: false }), t, NOW)).toEqual({
      tone: 'orange',
      icon: 'cloud',
      title: '2 changements en attente',
      description: 'Enregistrés sur l’iPhone, envoyés au retour du réseau.',
    });
    expect(pendingBanner(stale({ rejected: 1 }), t, NOW)).toEqual({
      tone: 'red',
      icon: 'alert',
      title: '4 changements en attente depuis plus de 24 h',
      description: 'Exportez-les par sécurité dans Réglages › Synchronisation.',
    });
    expect(pendingBanner(stale({ pending: 1 }), t, NOW).title).toBe(
      '1 changement en attente depuis plus de 24 h',
    );
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

  it('goes red with the whole count once the changes are a day old', () => {
    expect(syncValue(stale({ rejected: 1, online: false }), t, NOW)).toEqual({
      label: '4 en attente',
      color: 'red',
    });
  });
});

describe('syncCard', () => {
  it('shows the last time everything went through, with the day once it is past', () => {
    const now = new Date(2026, 9, 24, 15, 0);
    expect(syncCard(view(), t, now)).toEqual({
      state: 'synced',
      title: 'Tout est à jour',
      detail: 'Dernière synchronisation à 11 h 21',
    });
    expect(
      syncCard(view({ lastSyncAt: new Date(2026, 9, 22, 9, 5) }), t, now)
        .detail,
    ).toBe('Dernière synchronisation le 22 octobre à 9 h 05');
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

  it('raises the alert after a day and tells how to act, online or not', () => {
    expect(syncCard(stale(), t, NOW)).toEqual({
      state: 'alert',
      title: '3 changements en attente depuis plus de 24 h',
      detail: 'Exportez-les par sécurité, puis synchronisez dès que possible.',
    });
    expect(syncCard(stale({ pending: 1, online: false }), t, NOW)).toEqual({
      state: 'alert',
      title: '1 changement en attente depuis plus de 24 h',
      detail: 'Hors ligne. Exportez-les par sécurité.',
    });
  });

  it('says so when this iPhone never synchronised', () => {
    expect(syncCard(view({ lastSyncAt: null }), t).detail).toBe(
      'Jamais synchronisé sur cet iPhone',
    );
  });
});
