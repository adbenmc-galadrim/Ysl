import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { grab, shoot, type CaptureMode, type Shot } from '#/camera/capture';
import { readNative } from '#/camera/native';
import { clearPhotos, savePhoto } from '#/camera/opfs';
import type { CameraStream } from '#/camera/stream';
import { exportJournal } from '#/metrics/export';
import {
  captureStats,
  type Journal,
  type JournalEntry,
} from '#/metrics/journal';

type View = 'capture' | 'journal';

type Thumbnail = { index: number; url: string };

const BURST_SIZE = 50;
const BURST_SPACING_MS = 700;
const KEPT_THUMBNAILS = 12;

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

function milliseconds(value: number | undefined): string {
  return value === undefined ? '–' : `${Math.round(value)} ms`;
}

function heapBytes(): number | undefined {
  return (performance as Performance & { memory?: { usedJSHeapSize: number } })
    .memory?.usedJSHeapSize;
}

function useThumbnails() {
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);
  const kept = useRef<Thumbnail[]>([]);
  const add = (index: number, blob: Blob) => {
    const next = [{ index, url: URL.createObjectURL(blob) }, ...kept.current];
    for (const dropped of next.splice(KEPT_THUMBNAILS)) {
      URL.revokeObjectURL(dropped.url);
    }
    kept.current = next;
    setThumbnails(next);
  };
  const clear = () => {
    for (const thumbnail of kept.current) URL.revokeObjectURL(thumbnail.url);
    kept.current = [];
    setThumbnails([]);
  };
  return { thumbnails, add, clear };
}

export function App({ journal, camera }: AppProps) {
  useJournal(journal);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [view, setView] = useState<View>('capture');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [burstLeft, setBurstLeft] = useState(0);
  const stopBurst = useRef(false);
  const {
    thumbnails,
    add: addThumbnail,
    clear: clearThumbnails,
  } = useThumbnails();
  const stats = captureStats(journal.session.entries);

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
    const onPageShow = (event: PageTransitionEvent) => {
      journal.log('page-show', event.persisted ? 'bfcache' : undefined);
      const video = videoRef.current;
      if (video) {
        camera.resume(video).catch((reason: unknown) => {
          journal.log('resume-failed', errorDetail(reason));
          setError(errorDetail(reason));
        });
      }
    };
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

  const record = async (
    startedAt: number,
    at: number,
    mode: CaptureMode,
    shot: Shot,
    extra: { burst?: number; orientation?: number } = {},
  ) => {
    const name = `${journal.session.id}-${at}.jpg`;
    await savePhoto(name, shot.photo);
    const index = journal.capture({
      at,
      ...extra,
      mode,
      width: shot.width,
      height: shot.height,
      sourceWidth: shot.sourceWidth,
      sourceHeight: shot.sourceHeight,
      bytes: shot.photo.size,
      durationMs: performance.now() - startedAt,
      heapBytes: heapBytes(),
    });
    addThumbnail(index, shot.thumbnail);
  };

  const captureOnce = async (burst?: number) => {
    const video = videoRef.current;
    if (!video || !camera.live) throw new Error('Caméra arrêtée');
    const startedAt = performance.now();
    const at = Date.now();
    const { bitmap, mode } = await grab(video, camera.track, (reason) =>
      journal.log('grabframe-failed', errorDetail(reason)),
    );
    await record(startedAt, at, mode, await shoot(bitmap), { burst });
  };

  const importFiles = (input: HTMLInputElement) => {
    const files = [...(input.files ?? [])];
    input.value = '';
    void run(async () => {
      for (const file of files) {
        const startedAt = performance.now();
        const at = Date.now();
        const { bitmap, info } = await readNative(file);
        const raw =
          info.width === undefined ? '?' : `${info.width}×${info.height}`;
        journal.log(
          'native-file',
          `${file.type || 'type inconnu'} · ${(file.size / 1000).toFixed(0)} ko · brut ${raw} · EXIF ${info.orientation ?? 'absente'} · redressée ${bitmap.width}×${bitmap.height}`,
        );
        await record(startedAt, at, 'native', await shoot(bitmap), {
          orientation: info.orientation,
        });
      }
    });
  };

  const nativeButtons = (
    <span className="native" aria-disabled={busy}>
      <label className="button">
        Photo native
        <input
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          disabled={busy}
          onChange={(event) => importFiles(event.currentTarget)}
        />
      </label>
      <label className="button">
        Importer
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          disabled={busy}
          onChange={(event) => importFiles(event.currentTarget)}
        />
      </label>
    </span>
  );

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
    } catch (reason) {
      journal.log('capture-failed', errorDetail(reason));
      setError(errorDetail(reason));
    } finally {
      setBusy(false);
    }
  };

  const shutter = () => void run(() => captureOnce());

  const burst = () =>
    void run(async () => {
      const id = Date.now();
      stopBurst.current = false;
      journal.log('burst-started', `${BURST_SIZE} captures`);
      for (let left = BURST_SIZE; left > 0 && !stopBurst.current; left--) {
        setBurstLeft(left);
        const startedAt = performance.now();
        await captureOnce(id);
        const rest = BURST_SPACING_MS - (performance.now() - startedAt);
        if (rest > 0) await new Promise((done) => setTimeout(done, rest));
      }
      journal.log(
        stopBurst.current ? 'burst-stopped' : 'burst-finished',
        await storageUsage(),
      );
    }).finally(() => setBurstLeft(0));

  const clear = async () => {
    try {
      await clearPhotos();
      clearThumbnails();
      journal.log('photos-cleared', await storageUsage());
    } catch (reason) {
      journal.log('clear-failed', errorDetail(reason));
    }
  };

  const share = async () => {
    try {
      journal.log('journal-exported', await exportJournal(journal));
    } catch (reason) {
      journal.log('export-failed', errorDetail(reason));
    }
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
          {thumbnails.length > 0 && (
            <ol className="thumbnails">
              {thumbnails.map((thumbnail) => (
                <li key={thumbnail.index}>
                  <img src={thumbnail.url} alt={`Capture ${thumbnail.index}`} />
                </li>
              ))}
            </ol>
          )}
          <p className="status">
            {camera.live ? 'Flux actif' : 'Caméra arrêtée'} · {stats.count}{' '}
            captures · dernier écart {milliseconds(stats.lastIntervalMs)} · max{' '}
            {milliseconds(stats.maxIntervalMs)} · p95{' '}
            {milliseconds(stats.p95IntervalMs)} · relances {stats.restarts} ·
            échecs {stats.failures}
            {journal.interrupted ? ' · session précédente interrompue' : ''}
            {error ? ` · ${error}` : ''}
          </p>
          {camera.live ? (
            <div className="controls">
              {burstLeft > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    stopBurst.current = true;
                  }}
                >
                  Arrêter ({burstLeft})
                </button>
              ) : (
                <button type="button" disabled={busy} onClick={burst}>
                  Rafale {BURST_SIZE}
                </button>
              )}
              <button
                type="button"
                className="shutter"
                aria-label="Capturer"
                disabled={busy}
                onClick={shutter}
              />
              {nativeButtons}
            </div>
          ) : (
            <div className="controls">
              <span />
              <button type="button" className="primary" onClick={start}>
                Démarrer la caméra
              </button>
              {nativeButtons}
            </div>
          )}
        </div>
      </section>

      <section className="journal" hidden={view !== 'journal'}>
        <JournalView
          journal={journal}
          onExport={() => void share()}
          onClear={() => void clear()}
        />
      </section>
    </div>
  );
}

async function storageUsage(): Promise<string> {
  const { usage } = await navigator.storage.estimate();
  return usage === undefined
    ? 'stockage inconnu'
    : `stockage ${(usage / 1_000_000).toFixed(1)} Mo`;
}

function describeEntry(entry: JournalEntry): string {
  if (entry.kind === 'event') {
    return entry.detail ? `${entry.name} · ${entry.detail}` : entry.name;
  }
  const exif =
    entry.orientation === undefined ? '' : ` · EXIF ${entry.orientation}`;
  const heap =
    entry.heapBytes === undefined
      ? ''
      : ` · tas ${(entry.heapBytes / 1_000_000).toFixed(0)} Mo`;
  return `capture ${entry.index} · ${entry.mode} · ${entry.width}×${entry.height} · ${(entry.bytes / 1000).toFixed(0)} ko · ${Math.round(entry.durationMs)} ms${exif}${heap}`;
}

type JournalViewProps = {
  journal: Journal;
  onExport: () => void;
  onClear: () => void;
};

function JournalView({ journal, onExport, onClear }: JournalViewProps) {
  const { session, interrupted } = journal;
  const stats = captureStats(session.entries);
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
      <dl className="device">
        <div>
          <dt>captures</dt>
          <dd>{stats.count}</dd>
        </div>
        <div>
          <dt>écart rafale</dt>
          <dd>
            max {milliseconds(stats.maxIntervalMs)} · p95{' '}
            {milliseconds(stats.p95IntervalMs)}
          </dd>
        </div>
        <div>
          <dt>durée capture</dt>
          <dd>
            max {milliseconds(stats.maxDurationMs)} · p95{' '}
            {milliseconds(stats.p95DurationMs)}
          </dd>
        </div>
        <div>
          <dt>relances flux</dt>
          <dd>{stats.restarts}</dd>
        </div>
        <div>
          <dt>échecs</dt>
          <dd>{stats.failures}</dd>
        </div>
      </dl>
      <div className="actions">
        <button type="button" className="primary" onClick={onExport}>
          Exporter le journal
        </button>
        <button type="button" onClick={onClear}>
          Vider les photos
        </button>
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
