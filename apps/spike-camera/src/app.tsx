import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { CameraStream } from '#/camera/stream';
import type { Journal, JournalEntry } from '#/metrics/journal';

type View = 'capture' | 'journal';

type AppProps = {
  journal: Journal;
  camera: CameraStream;
};

function errorDetail(error: unknown): string {
  return error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error);
}

function clock(at: number): string {
  const time = new Date(at);
  const ms = String(time.getMilliseconds()).padStart(3, '0');
  return `${time.toLocaleTimeString('fr-FR')}.${ms}`;
}

function useJournal(journal: Journal): void {
  useSyncExternalStore(journal.subscribe, journal.getVersion);
}

export function App({ journal, camera }: AppProps) {
  useJournal(journal);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [view, setView] = useState<View>('capture');
  const [error, setError] = useState<string>();

  useEffect(() => {
    const onVisibility = () => {
      const visible = document.visibilityState === 'visible';
      journal.log(visible ? 'page-visible' : 'page-hidden');
      const video = videoRef.current;
      if (visible && video) {
        camera.resume(video).catch((reason: unknown) => {
          journal.log('resume-failed', errorDetail(reason));
          setError(errorDetail(reason));
        });
      }
    };
    const onPageShow = (event: PageTransitionEvent) =>
      journal.log('page-show', event.persisted ? 'bfcache' : undefined);
    const onPageHide = () => journal.log('page-hide');
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [journal, camera]);

  const start = () => {
    const video = videoRef.current;
    if (!video) return;
    setError(undefined);
    camera.start(video).catch((reason: unknown) => {
      journal.log('stream-error', errorDetail(reason));
      setError(errorDetail(reason));
    });
  };

  return (
    <div className="app">
      <nav className="tabs">
        <button
          type="button"
          aria-pressed={view === 'capture'}
          onClick={() => setView('capture')}
        >
          Capture
        </button>
        <button
          type="button"
          aria-pressed={view === 'journal'}
          onClick={() => setView('journal')}
        >
          Journal
        </button>
      </nav>

      <section className="capture" hidden={view !== 'capture'}>
        <video ref={videoRef} playsInline muted autoPlay />
        <div className="hud">
          <p className="status">
            {camera.live ? 'Flux actif' : 'Caméra arrêtée'}
            {error ? ` · ${error}` : ''}
          </p>
          {!camera.live && (
            <button type="button" className="primary" onClick={start}>
              Démarrer la caméra
            </button>
          )}
        </div>
      </section>

      <section className="journal" hidden={view !== 'journal'}>
        <JournalView journal={journal} />
      </section>
    </div>
  );
}

function describeEntry(entry: JournalEntry): string {
  return entry.detail ? `${entry.name} · ${entry.detail}` : entry.name;
}

function JournalView({ journal }: { journal: Journal }) {
  const { session, interrupted } = journal;
  return (
    <>
      {interrupted && (
        <p className="warning">
          Session précédente interrompue ({clock(interrupted.startedAt)},{' '}
          {interrupted.entries.length} entrées) : plantage, rechargement ou app
          tuée.
        </p>
      )}
      <dl className="device">
        {Object.entries(session.device).map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{String(value)}</dd>
          </div>
        ))}
      </dl>
      <div className="actions">
        <button
          type="button"
          disabled={session.closedAt !== undefined}
          onClick={() => journal.close()}
        >
          {session.closedAt ? 'Session terminée' : 'Terminer la session'}
        </button>
      </div>
      <ol className="entries" reversed>
        {[...session.entries].reverse().map((entry, index) => (
          <li key={session.entries.length - index}>
            <time>{clock(entry.at)}</time> {describeEntry(entry)}
          </li>
        ))}
      </ol>
    </>
  );
}
