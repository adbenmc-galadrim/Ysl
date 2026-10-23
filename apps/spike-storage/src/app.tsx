import { useEffect, useState, useSyncExternalStore } from 'react';
import { exportJournal } from '#/export';
import type { Journal } from '#/journal';
import type { Updater } from '#/update/register';

type View = 'state' | 'journal';

type AppProps = {
  journal: Journal;
  updater: Updater;
  version: string;
  writing: boolean;
};

function clock(at: number): string {
  const time = new Date(at);
  const ms = String(time.getMilliseconds()).padStart(3, '0');
  return `${time.toLocaleTimeString('fr-FR')}.${ms}`;
}

function yesNo(value: unknown): string {
  return value ? 'oui' : 'non';
}

export function App({ journal, updater, version, writing }: AppProps) {
  useSyncExternalStore(journal.subscribe, journal.getVersion);
  const update = useSyncExternalStore(updater.subscribe, updater.getState);
  const [view, setView] = useState<View>('state');
  const [shared, setShared] = useState<string>();

  useEffect(() => {
    const onVisibility = () =>
      journal.log(
        document.visibilityState === 'visible' ? 'page-visible' : 'page-hidden',
      );
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
  }, [journal]);

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

  const { session, interrupted } = journal;

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
            <dd>{yesNo(session.device.standalone)}</dd>
          </div>
          <div>
            <dt>service worker</dt>
            <dd>{update.worker}</dd>
          </div>
        </dl>
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
          {Object.entries(session.device).map(([key, value]) => (
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
            disabled={session.closedAt !== undefined}
            onClick={() => journal.close()}
          >
            {session.closedAt ? 'Session terminée' : 'Terminer la session'}
          </button>
        </div>
        {shared && <p className="status">Journal {shared}.</p>}
        <ol className="entries" reversed>
          {[...session.entries].reverse().map((entry, index) => (
            <li key={session.entries.length - index}>
              <time>{clock(entry.at)}</time> {entry.name}
              {entry.detail ? ` · ${entry.detail}` : ''}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
