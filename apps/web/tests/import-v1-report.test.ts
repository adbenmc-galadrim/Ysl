import type { V1ImportReport } from '@repo/contract/imports';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { describe, expect, it } from 'vitest';
import { importV1View } from '#/features/imports/report';

const t = createTranslator(DEFAULT_LOCALE);

const report: V1ImportReport = {
  imported: 7,
  skipped: 2,
  contactsCreated: 1,
  flagged: [
    {
      line: 3,
      tracking: '7185713569',
      recipient: 'Éloïse Martin',
      carrier: 'FedEx',
      flags: ['tracking-rejected'],
    },
    {
      line: 6,
      tracking: '10464000209404',
      recipient: null,
      carrier: 'DPD',
      flags: ['status-unknown', 'recipient-missing'],
      status: 'Perdu',
    },
  ],
  skips: [
    {
      line: 9,
      tracking: 'RR473124829GB',
      recipient: null,
      reason: 'date-invalid',
    },
    { line: 10, tracking: '', recipient: 'Marc', reason: 'tracking-missing' },
  ],
};

describe('importV1View', () => {
  it('offers to pick the file, unless offline', () => {
    expect(importV1View({ step: 'ready' }, true, t)).toMatchObject({
      state: 'ready',
      action: 'Choisir le fichier CSV',
    });
    expect(importV1View({ step: 'ready' }, false, t)).toEqual({
      state: 'offline',
      title: 'Hors ligne',
      detail: 'L’import passe par le serveur : reconnectez l’iPhone.',
    });
  });

  it('waits on the file without offering anything', () => {
    expect(
      importV1View({ step: 'importing', fileName: 'v1.csv' }, true, t),
    ).toEqual({
      state: 'importing',
      title: 'Import en cours…',
      detail: 'v1.csv',
    });
  });

  it('counts what came in and lists the signalled trackings first', () => {
    const view = importV1View({ step: 'done', report }, true, t);
    expect(view).toMatchObject({
      state: 'flagged',
      title: '7 colis importés',
      detail: '2 lignes ignorées · 1 tracking signalé · 1 contact créé',
      action: 'Importer un autre fichier',
    });
    expect(
      view.groups?.map((group) => [
        group.header,
        group.items.map((item) => [item.label, item.subtitle, item.value]),
      ]),
    ).toEqual([
      [
        'Trackings signalés',
        [['7185713569', 'Ligne 3 · clé fausse · Éloïse Martin', 'FedEx']],
      ],
      [
        'À compléter',
        [
          [
            '10464000209404',
            'Ligne 6 · statut « Perdu » inconnu · sans destinataire',
            'DPD',
          ],
        ],
      ],
      [
        'Lignes ignorées',
        [
          ['Ligne 9', 'RR473124829GB · date de réception illisible', undefined],
          ['Ligne 10', 'Sans tracking', undefined],
        ],
      ],
    ]);
  });

  it('says so when the file brought nothing new', () => {
    expect(
      importV1View(
        {
          step: 'done',
          report: { ...report, imported: 0, flagged: [], contactsCreated: 0 },
        },
        true,
        t,
      ),
    ).toMatchObject({
      state: 'done',
      title: 'Aucun colis importé',
      detail: '2 lignes ignorées · 0 trackings signalés · 0 contacts créés',
    });
  });

  it('shows why the server refused the file', () => {
    expect(
      importV1View({ step: 'failed', message: 'Pas un export' }, true, t),
    ).toMatchObject({
      state: 'failed',
      title: 'Fichier refusé',
      detail: 'Pas un export',
      action: 'Choisir un autre fichier',
    });
  });
});
