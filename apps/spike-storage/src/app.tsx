import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import { errorDetail } from '#/errors';
import { exportJournal } from '#/export';
import type { Journal } from '#/journal';
import type { SpikeDatabase } from '#/storage/db';
import { runIntegrityCheck, type IntegrityReport } from '#/storage/integrity';
import { clearPhotos } from '#/storage/opfs';
import {
  readPersisted,
  readStorage,
  requestPersist,
  type StorageStatus,
} from '#/storage/quota';
import type { Writer } from '#/storage/writer';
import type { Updater } from '#/update/register';

type View = 'state' | 'journal';

type AppProps = {
  journal: Journal;
  updater: Updater;
  writer: Writer;
  db: SpikeDatabase;
  version: string;
};

type Stats = { count: number; storage: StorageStatus };
type StoredReport = { at: number; reason: string; value: IntegrityReport };

function clock(at: number): string {
  const time = new Date(at);
  const ms = String(time.getMilliseconds()).padStart(3, '0');
  return `${time.toLocaleTimeString('fr-FR')}.${ms}`;
}

function yesNo(value: unknown): string {
  return value ? 'oui' : 'non';
}

function megabytes(bytes: number | undefined): string {
  return bytes === undefined ? '–' : `${(bytes / 1_048_576).toFixed(1)} Mo`;
}

function ids(list: readonly (number | string)[]): string {
  if (list.length === 0) return '0';
  const shown = list.slice(0, 10).join(', ');
  return `${list.length} (${shown}${list.length > 10 ? ', …' : ''})`;
}

function reportSummary(report: IntegrityReport): string {
  return [
    report.noLoss ? 'aucune perte' : 'PERTE',
    `${report.parcels} colis`,
    `${report.files} fichiers`,
    `sans photo ${report.parcelsWithoutPhoto.length}`,
    `orphelines ${report.orphanPhotos.length}`,
    `taille ${report.sizeMismatches.length}`,
    `sha ${report.shaMismatches.length}`,
    `trous ${report.seqGaps.length}`,
    `outbox sans colis ${report.outboxWithoutParcel.length}`,
    `colis sans outbox ${report.parcelsWithoutOutbox.length}`,
  ].join(' · ');
}

function reportRows(report: IntegrityReport): [string, string][] {
  return [
    ['colis (Dexie)', String(report.parcels)],
    ['fichiers (OPFS)', String(report.files)],
    ['lignes sans photo', ids(report.parcelsWithoutPhoto)],
    ['photos orphelines (tolérées)', ids(report.orphanPhotos)],
    ['taille différente', ids(report.sizeMismatches)],
    ['SHA-256 différent', ids(report.shaMismatches)],
    ['trous dans seq', ids(report.seqGaps)],
    ['outbox sans colis', ids(report.outboxWithoutParcel)],
    ['colis sans outbox', ids(report.parcelsWithoutOutbox)],
  ];
}

export function App({ journal, updater, writer, db, version }: AppProps) {
  useSyncExternalStore(journal.subscribe, journal.getVersion);
  const update = useSyncExternalStore(updater.subscribe, updater.getState);
  const writeState = useSyncExternalStore(writer.subscribe, writer.getState);
  const writing = writeState.running;
  const [view, setView] = useState<View>('state');
  const [shared, setShared] = useState<string>();
  const [stats, setStats] = useState<Stats>();
  const [report, setReport] = useState<StoredReport>();
  const [checking, setChecking] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStats({
        count: await db.parcels.count(),
        storage: await readStorage(),
      });
    } catch (error) {
      journal.log('stats-failed', errorDetail(error));
    }
  }, [db, journal]);

  const check = useCallback(
    async (reason: string) => {
      setChecking(true);
      try {
        await writer.idle();
        const value = await runIntegrityCheck(db);
        journal.log('integrity-check', `${reason} · ${reportSummary(value)}`);
        setReport({ at: Date.now(), reason, value });
      } catch (error) {
        journal.log('integrity-check-failed', errorDetail(error));
      } finally {
        setChecking(false);
      }
      await refresh();
    },
    [db, journal, writer, refresh],
  );

  const askPersist = useCallback(async () => {
    try {
      const granted = await requestPersist();
      journal.log(
        'persist-requested',
        granted === undefined ? 'non supporté' : yesNo(granted),
      );
    } catch (error) {
      journal.log('persist-failed', errorDetail(error));
    }
    await refresh();
  }, [journal, refresh]);

  useEffect(() => {
    void (async () => {
      try {
        const persisted = await readPersisted();
        journal.log('persisted', String(persisted));
        if (persisted === false) await askPersist();
        const storage = await readStorage();
        journal.log(
          'storage-estimate',
          `${megabytes(storage.usage)} / ${megabytes(storage.quota)}`,
        );
      } catch (error) {
        journal.log('storage-read-failed', errorDetail(error));
      }
    })();
    void check('lancement');
  }, [journal, askPersist, check]);

  useEffect(() => {
    void refresh();
  }, [refresh, writeState.done, writeState.running]);

  const clearAll = async () => {
    if (!confirm('Effacer tous les colis, les photos et le journal ?')) return;
    writer.stop();
    try {
      await writer.idle();
      await db.transaction('rw', db.parcels, db.outbox, () =>
        Promise.all([db.parcels.clear(), db.outbox.clear()]),
      );
      await clearPhotos();
      journal.clear();
      journal.log('cleared-all');
      setReport(undefined);
    } catch (error) {
      journal.log('clear-failed', errorDetail(error));
    }
    await refresh();
  };

  useEffect(() => {
    const onVisibility = () => {
      const visible = document.visibilityState === 'visible';
      journal.log(visible ? 'page-visible' : 'page-hidden');
      if (visible) void check('retour au premier plan');
    };
    const onOnline = () => journal.log('online');
    const onOffline = () => journal.log('offline');
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [journal, check]);

  const share = () => {
    exportJournal(journal, version)
      .then((outcome) => {
        journal.log('export', outcome);
        setShared(outcome);
      })
      .catch((reason: unknown) => {
        journal.log(
          'export-failed',
          reason instanceof Error ? reason.name : String(reason),
        );
      });
  };

  const { session: journalSession, interrupted } = journal;

  return (
    <div className="app">
      <nav className="tabs">
        <button
          type="button"
          aria-pressed={view === 'state'}
          onClick={() => setView('state')}
        >
          État
        </button>
        <button
          type="button"
          aria-pressed={view === 'journal'}
          onClick={() => setView('journal')}
        >
          Journal
        </button>
      </nav>

      {update.needRefresh && !writing && (
        <div className="banner" role="status">
          <span>Nouvelle version disponible</span>
          <button type="button" className="primary" onClick={updater.apply}>
            Mettre à jour
          </button>
        </div>
      )}

      <section className="panel" hidden={view !== 'state'}>
        {interrupted && (
          <p className="warning">
            Session précédente interrompue ({clock(interrupted.startedAt)},{' '}
            {interrupted.entries.length} entrées) : plantage, rechargement ou
            app tuée.
          </p>
        )}
        <dl className="device">
          <div>
            <dt>version</dt>
            <dd>{version}</dd>
          </div>
          <div>
            <dt>version distante</dt>
            <dd>{update.remoteVersion ?? '–'}</dd>
          </div>
          <div>
            <dt>dernière vérif.</dt>
            <dd>
              {update.lastCheckAt === undefined
                ? '–'
                : clock(update.lastCheckAt)}
            </dd>
          </div>
          <div>
            <dt>standalone</dt>
            <dd>{yesNo(journalSession.device.standalone)}</dd>
          </div>
          <div>
            <dt>service worker</dt>
            <dd>{update.worker}</dd>
          </div>
        </dl>
        <dl className="device">
          <div>
            <dt>persisté</dt>
            <dd>{stats ? yesNo(stats.storage.persisted) : '–'}</dd>
          </div>
          <div>
            <dt>usage / quota</dt>
            <dd>
              {megabytes(stats?.storage.usage)} /{' '}
              {megabytes(stats?.storage.quota)}
            </dd>
          </div>
          <div>
            <dt>colis</dt>
            <dd>{stats?.count ?? '–'}</dd>
          </div>
          <div>
            <dt>écriture</dt>
            <dd>
              {writing
                ? `${writeState.done}/${writeState.total}`
                : writeState.total > 0
                  ? `terminée (${writeState.done}/${writeState.total})`
                  : '–'}
            </dd>
          </div>
        </dl>
        <div className="actions">
          <button
            type="button"
            className="primary"
            disabled={writing}
            onClick={() => void writer.startSession()}
          >
            Écrire 100 colis
          </button>
          <button
            type="button"
            disabled={writing}
            onClick={() => void writer.writeOne().then(() => refresh())}
          >
            Écrire 1 colis
          </button>
          <button type="button" disabled={!writing} onClick={writer.stop}>
            Arrêter
          </button>
        </div>
        <div className="actions">
          <button
            type="button"
            className="primary"
            disabled={checking}
            onClick={() => void check('manuel')}
          >
            Contrôler
          </button>
          <button type="button" onClick={() => void askPersist()}>
            Demander le stockage persistant
          </button>
          <button type="button" onClick={() => void clearAll()}>
            Effacer tout
          </button>
        </div>
        {report && (
          <div className="report" data-no-loss={report.value.noLoss}>
            <p className={report.value.noLoss ? 'status' : 'warning'}>
              <strong>
                {report.value.noLoss ? 'Aucune perte' : 'Perte détectée'}
              </strong>{' '}
              · {clock(report.at)} · {report.reason}
            </p>
            <dl className="device">
              {reportRows(report.value).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        <div className="actions">
          <button
            type="button"
            className="primary"
            onClick={() => void updater.check('manuel')}
          >
            Vérifier les mises à jour
          </button>
          <button type="button" onClick={() => void updater.force()}>
            Forcer la mise à jour
          </button>
        </div>
      </section>

      <section className="panel" hidden={view !== 'journal'}>
        <dl className="device">
          {Object.entries(journalSession.device).map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
        </dl>
        <div className="actions">
          <button type="button" className="primary" onClick={share}>
            Exporter le journal
          </button>
          <button
            type="button"
            disabled={journalSession.closedAt !== undefined}
            onClick={() => journal.close()}
          >
            {journalSession.closedAt ? 'Session terminée' : 'Terminer la session'}
          </button>
        </div>
        {shared && <p className="status">Journal {shared}.</p>}
        <ol className="entries" reversed>
          {[...journalSession.entries].reverse().map((entry, index) => (
            <li key={journalSession.entries.length - index}>
              <time>{clock(entry.at)}</time> {entry.name}
              {entry.detail ? ` · ${entry.detail}` : ''}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
