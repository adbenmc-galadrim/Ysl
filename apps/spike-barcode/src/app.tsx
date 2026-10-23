import { carriers } from '@repo/corpus/src/schema.ts';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { grab } from '#/camera/grab';
import { readNative } from '#/camera/native';
import type { CameraStream } from '#/camera/stream';
import type { Symbol } from '#/decode/zxing';
import { exportJournal } from '#/export';
import {
  rates,
  type Journal,
  type Mode,
  type Rate,
  type Trial,
  type Verdict,
} from '#/journal';
import type { Decoder } from '#/worker/client';
import type { DecodeResult, StepName } from '#/worker/protocol';

type View = 'scan' | 'journal';

type AppProps = {
  journal: Journal;
  camera: CameraStream;
  decoder: Decoder;
};

const VERDICTS: { value: Verdict; label: string }[] = [
  { value: 'read', label: 'Tracking lu' },
  { value: 'code-sans-tracking', label: 'Code lu sans tracking' },
  { value: 'aucun-code', label: 'Rien lu' },
];

const MODE_LABELS: Record<Mode, string> = {
  viewfinder: 'Viseur',
  native: 'Photo native',
};

const STEP_LABELS: Record<StepName, string> = {
  'whole-1600': 'entière 1 600 px',
  'whole-2400': 'entière 2 400 px',
  tiles: 'tuiles pleine résolution',
  maxicode: 'MaxiCode recadré',
};

const errorDetail = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

const visible = (text: string): string =>
  [...text]
    .map((char) => {
      const code = char.charCodeAt(0);
      return code < 32 ? `‹${code.toString(16).padStart(2, '0')}›` : char;
    })
    .join('');

const ms = (value: number | null | undefined): string =>
  value === null || value === undefined ? '–' : `${Math.round(value)} ms`;

const percent = (rate: Rate): string =>
  rate.rate === null
    ? '–'
    : `${Math.round(rate.rate * 100)} % (${rate.read}/${rate.trials})`;

const clock = (at: number): string => new Date(at).toLocaleTimeString('fr-FR');

const useJournal = (journal: Journal): void => {
  useSyncExternalStore(journal.subscribe, journal.getVersion);
};

const place = (symbol: Symbol): string => {
  const { topLeft, bottomRight } = symbol.position;
  return `(${Math.round(topLeft.x)}, ${Math.round(topLeft.y)}) → (${Math.round(bottomRight.x)}, ${Math.round(bottomRight.y)})`;
};

export function App({ journal, camera, decoder }: AppProps) {
  useJournal(journal);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [view, setView] = useState<View>('scan');
  const [carrier, setCarrier] = useState<string>('other');
  const [forceMaxiCode, setForceMaxiCode] = useState(false);
  const [exhaustive, setExhaustive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [lastId, setLastId] = useState<string>();
  const last = journal.trials.find((trial) => trial.id === lastId);

  useEffect(() => {
    const resume = () => {
      const video = videoRef.current;
      if (video) {
        camera.resume(video).catch((reason: unknown) => {
          journal.log('resume-failed', errorDetail(reason));
        });
      }
    };
    const onVisibility = () => {
      const shown = document.visibilityState === 'visible';
      journal.log(shown ? 'page-visible' : 'page-hidden');
      if (shown) resume();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      journal.log('page-show', event.persisted ? 'bfcache' : undefined);
      resume();
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

  const run = async (mode: Mode, source: () => Promise<ImageBitmap>) => {
    setBusy(true);
    setError(undefined);
    try {
      const bitmap = await source();
      let result: DecodeResult | null = null;
      let failure: string | undefined;
      try {
        result = await decoder.decode(bitmap, { forceMaxiCode, exhaustive });
      } catch (reason) {
        failure = errorDetail(reason);
        setError(failure);
        journal.log('decode-failed', failure);
      }
      setLastId(journal.addTrial({ mode, carrier, result, error: failure }).id);
    } catch (reason) {
      setError(errorDetail(reason));
      journal.log('capture-failed', errorDetail(reason));
    } finally {
      setBusy(false);
    }
  };

  const startCamera = () => {
    const video = videoRef.current;
    if (!video) return;
    setError(undefined);
    camera.start(video).catch((reason: unknown) => {
      journal.log('stream-error', errorDetail(reason));
      setError(errorDetail(reason));
    });
  };

  const readViewfinder = () =>
    void run('viewfinder', async () => {
      const video = videoRef.current;
      if (!video || !camera.live) throw new Error('Caméra arrêtée');
      const { bitmap, source } = await grab(video, camera.track, (reason) =>
        journal.log('grabframe-failed', errorDetail(reason)),
      );
      journal.log('frame', source);
      return bitmap;
    });

  const importFile = (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = '';
    if (file) void run('native', () => readNative(file));
  };

  const share = async () => {
    try {
      journal.log('journal-exported', await exportJournal(journal));
    } catch (reason) {
      journal.log('export-failed', errorDetail(reason));
    }
  };

  const parcelTrials = journal.trials.filter(
    (trial) => trial.parcel === journal.parcel,
  );

  return (
    <div className="app">
      <nav className="tabs">
        <button
          type="button"
          aria-pressed={view === 'scan'}
          onClick={() => setView('scan')}
        >
          Scan
        </button>
        <button
          type="button"
          aria-pressed={view === 'journal'}
          onClick={() => setView('journal')}
        >
          Journal
        </button>
      </nav>

      <section className="scan" hidden={view !== 'scan'}>
        <div className="parcel">
          <strong>Colis n° {journal.parcel}</strong>
          <span>
            {parcelTrials.length} essai{parcelTrials.length > 1 ? 's' : ''}
          </span>
          <button type="button" onClick={() => journal.nextParcel()}>
            Colis suivant
          </button>
        </div>
        <label className="field">
          Transporteur
          <select
            value={carrier}
            onChange={(event) => setCarrier(event.target.value)}
          >
            {carriers.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <div className="options">
          <label>
            <input
              type="checkbox"
              checked={forceMaxiCode}
              onChange={(event) => setForceMaxiCode(event.target.checked)}
            />
            Forcer le MaxiCode recadré
          </label>
          <label>
            <input
              type="checkbox"
              checked={exhaustive}
              onChange={(event) => setExhaustive(event.target.checked)}
            />
            Toutes les étapes
          </label>
        </div>
        <div className="viewfinder">
          <video ref={videoRef} playsInline muted autoPlay />
        </div>
        <div className="controls">
          {camera.live ? (
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={readViewfinder}
            >
              Lire
            </button>
          ) : (
            <button type="button" className="primary" onClick={startCamera}>
              Démarrer la caméra
            </button>
          )}
          <label className="button" aria-disabled={busy}>
            Photo native
            <input
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              disabled={busy}
              onChange={(event) => importFile(event.currentTarget)}
            />
          </label>
        </div>
        {busy && <p className="status">Lecture en cours…</p>}
        {error && <p className="warning">{error}</p>}
        {last && (
          <ResultPanel
            trial={last}
            onVerdict={(verdict) =>
              journal.updateTrial(last.id, { verdict, carrier })
            }
            onNote={(note) => journal.updateTrial(last.id, { note })}
          />
        )}
      </section>

      <section className="journal" hidden={view !== 'journal'}>
        <JournalView
          journal={journal}
          onExport={() => void share()}
          onClear={() => {
            if (confirm('Effacer tout le journal ?')) journal.clear();
          }}
        />
      </section>
    </div>
  );
}

type ResultPanelProps = {
  trial: Trial;
  onVerdict: (verdict: Verdict) => void;
  onNote: (note: string) => void;
};

function ResultPanel({ trial, onVerdict, onNote }: ResultPanelProps) {
  const { result } = trial;
  return (
    <div className="result">
      <h2>
        Colis {trial.parcel} · {MODE_LABELS[trial.mode]}
      </h2>
      {result ? (
        <>
          <p className="status">
            {result.symbols.length} symbole
            {result.symbols.length > 1 ? 's' : ''} · image {result.width}×
            {result.height} · {ms(result.totalMs)} · stratégie{' '}
            {result.winner ? STEP_LABELS[result.winner] : 'aucune'}
          </p>
          <ul className="symbols">
            {result.symbols.map((symbol, index) => (
              <li key={`${symbol.format}-${index}`}>
                <span className="badge">{symbol.format}</span>
                <code>{visible(symbol.text)}</code>
                <small>{place(symbol)}</small>
              </li>
            ))}
          </ul>
          <p className="status">
            MaxiCode : sans recadrage {result.maxicode.plain ? 'lu' : 'non lu'}{' '}
            · avec recadrage{' '}
            {result.maxicode.cropped === null
              ? 'non tenté'
              : result.maxicode.cropped
                ? `lu (${ms(result.maxicode.croppedMs)}, ${result.maxicode.candidates} candidat${(result.maxicode.candidates ?? 0) > 1 ? 's' : ''})`
                : `non lu (${ms(result.maxicode.croppedMs)})`}
          </p>
          <ol className="steps">
            {result.steps.map((step) => (
              <li key={step.name}>
                {STEP_LABELS[step.name]} · {step.width}×{step.height} ·{' '}
                {ms(step.ms)} · {step.symbols} symbole
                {step.symbols > 1 ? 's' : ''}
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="warning">Lecture en échec : {trial.error}</p>
      )}
      <div className="verdicts">
        {VERDICTS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={trial.verdict === value}
            onClick={() => onVerdict(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <input
        className="note"
        type="text"
        placeholder="Note libre"
        value={trial.note}
        onChange={(event) => onNote(event.target.value)}
      />
    </div>
  );
}

type JournalViewProps = {
  journal: Journal;
  onExport: () => void;
  onClear: () => void;
};

function RateTable({
  title,
  groups,
}: {
  title: string;
  groups: Record<string, Rate>;
}) {
  const rows = Object.entries(groups);
  return (
    <table className="rates">
      <caption>{title}</caption>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td>Aucun essai qualifié</td>
          </tr>
        ) : (
          rows.map(([key, rate]) => (
            <tr key={key}>
              <th scope="row">{key}</th>
              <td>{percent(rate)}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function JournalView({ journal, onExport, onClear }: JournalViewProps) {
  const byParcel = new Map<number, Trial[]>();
  for (const trial of journal.trials) {
    byParcel.set(trial.parcel, [...(byParcel.get(trial.parcel) ?? []), trial]);
  }
  const verdictLabel = (trial: Trial) =>
    VERDICTS.find((v) => v.value === trial.verdict)?.label ?? 'à qualifier';
  return (
    <>
      {journal.saveFailed && (
        <p className="warning">Le journal n’a pas pu être enregistré.</p>
      )}
      <div className="actions">
        <button type="button" className="primary" onClick={onExport}>
          Exporter le journal
        </button>
        <button type="button" onClick={onClear}>
          Tout effacer
        </button>
      </div>
      <RateTable
        title="Taux de tracking lu par mode"
        groups={rates(journal.trials, (t) => MODE_LABELS[t.mode])}
      />
      <RateTable
        title="Taux de tracking lu par transporteur"
        groups={rates(journal.trials, (t) => t.carrier)}
      />
      {[...byParcel.entries()].map(([parcel, trials]) => (
        <div key={parcel} className="parcel-card">
          <h3>Colis n° {parcel}</h3>
          <ul>
            {trials.map((trial) => (
              <li key={trial.id}>
                <strong>{MODE_LABELS[trial.mode]}</strong> · {trial.carrier} ·{' '}
                {verdictLabel(trial)}
                <br />
                <small>
                  {clock(trial.at)} ·{' '}
                  {trial.result
                    ? `${trial.result.symbols.length} symbole(s) · ${ms(trial.result.totalMs)}`
                    : `échec : ${trial.error}`}
                  {trial.note ? ` · ${trial.note}` : ''}
                </small>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <h3>Événements</h3>
      <ol className="entries" reversed>
        {[...journal.events].reverse().map((event, index) => (
          <li key={journal.events.length - index}>
            <time>{clock(event.at)}</time> {event.name}
            {event.detail ? ` · ${event.detail}` : ''}
          </li>
        ))}
      </ol>
    </>
  );
}
