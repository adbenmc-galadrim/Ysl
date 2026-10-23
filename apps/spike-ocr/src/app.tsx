import { useEffect, useState, useSyncExternalStore } from 'react';
import { readCapabilities, type Capabilities } from '#/capabilities';
import { ENGINE_CONFIGS } from '#/engines/configs';
import { exportJson } from '#/export';
import { clock, megabytes, ms, percent } from '#/format';
import { seriesStats } from '#/metrics/stats';
import { describeInterruption, type RunJournal } from '#/metrics/run-journal';
import type { SeriesResult } from '#/metrics/types';
import { ALL_CONFIG_IDS, type Controller } from '#/run/controller';

const ALL = 'all';

type SourceChoice = 'pack-50' | 'pack-96' | 'import';

const OUTCOMES: Record<SeriesResult['outcome'], string> = {
  complete: 'terminée',
  'load-failed': 'échec du chargement',
  stopped: 'arrêtée',
  crashed: 'plantage',
};

type AppProps = { controller: Controller; journal: RunJournal };

function yesNo(value: boolean): string {
  return value ? 'oui' : 'non';
}

function gpuLabel(gpu: Capabilities['gpu']): string {
  if (!gpu) return 'aucun';
  if ('error' in gpu) return `échec : ${gpu.error}`;
  const parts = [gpu.vendor, gpu.architecture, gpu.device, gpu.description];
  return parts.filter(Boolean).join(' · ') || 'adaptateur sans description';
}

function CapabilitiesSection({ value }: { value: Capabilities | undefined }) {
  if (!value) return <p className="muted">Lecture des capacités…</p>;
  return (
    <dl className="capabilities">
      <dt>crossOriginIsolated</dt>
      <dd data-testid="isolated">{yesNo(value.crossOriginIsolated)}</dd>
      <dt>SharedArrayBuffer</dt>
      <dd>{yesNo(value.sharedArrayBuffer)}</dd>
      <dt>WebGPU</dt>
      <dd data-testid="webgpu">{yesNo(value.webgpu)}</dd>
      <dt>Adaptateur WebGPU</dt>
      <dd>{gpuLabel(value.gpu)}</dd>
      <dt>Cœurs</dt>
      <dd>{value.hardwareConcurrency}</dd>
      <dt>Threads WASM</dt>
      <dd data-testid="threads">{value.wasmThreads}</dd>
      <dt>Mémoire déclarée</dt>
      <dd>
        {value.deviceMemoryGb === undefined
          ? 'non exposée'
          : `${value.deviceMemoryGb} Go`}
      </dd>
      <dt>Écran</dt>
      <dd>{value.screen}</dd>
      <dt>Navigateur</dt>
      <dd>{value.userAgent}</dd>
    </dl>
  );
}

function ResultsTable({ results }: { results: readonly SeriesResult[] }) {
  if (results.length === 0) {
    return <p className="muted">Aucune série pour l’instant.</p>;
  }
  return (
    <div className="table-wrap">
      <table data-testid="results">
        <thead>
          <tr>
            <th>Configuration</th>
            <th>Photos</th>
            <th>Charg. ms</th>
            <th>p50 ms</th>
            <th>p95 ms</th>
            <th>max ms</th>
            <th>Modèles Mo</th>
            <th>Tas WASM max Mo</th>
            <th>Échecs</th>
            <th>Dest. top 3</th>
            <th>Exp.</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result) => {
            const stats = seriesStats(result.photos);
            return (
              <tr key={`${result.configId}-${result.startedAt}`}>
                <td>
                  {result.label}
                  <div className="muted">
                    {result.source === 'pack' ? 'pack' : 'importées'} ·{' '}
                    {OUTCOMES[result.outcome]}
                    {result.detail ? ` : ${result.detail}` : ''}
                  </div>
                </td>
                <td>{stats.photos}</td>
                <td>{ms(result.loadMs)}</td>
                <td>{ms(stats.total.p50)}</td>
                <td>{ms(stats.total.p95)}</td>
                <td>{ms(stats.total.max)}</td>
                <td>{megabytes(result.modelBytes)}</td>
                <td>{megabytes(stats.maxWasmHeapBytes)}</td>
                <td>{stats.failures}</td>
                <td>{percent(result.accuracy?.recipient.rate)}</td>
                <td>{percent(result.accuracy?.sender.rate)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function App({ controller, journal }: AppProps) {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  );
  const [capabilities, setCapabilities] = useState<Capabilities>();
  const [choice, setChoice] = useState(ENGINE_CONFIGS[0]?.id ?? ALL);
  const [source, setSource] = useState<SourceChoice>('pack-50');
  const [exported, setExported] = useState<string>();

  useEffect(() => {
    void readCapabilities().then(setCapabilities);
  }, []);

  const start = () => {
    const configIds = choice === ALL ? ALL_CONFIG_IDS : [choice];
    const request =
      source === 'import'
        ? { configIds, source: 'import' as const, count: 0 }
        : {
            configIds,
            source: 'pack' as const,
            count: source === 'pack-50' ? 50 : 96,
          };
    controller.start(request).catch((error: unknown) => {
      journal.log(
        'start-failed',
        error instanceof Error ? error.message : String(error),
      );
    });
  };

  const progress = state.progress;
  const latest = [...journal.history].reverse();
  const last = state.last;

  return (
    <main className="app">
      <header>
        <h1>Spike S3 · OCR</h1>
        <p className="muted">
          Moteurs OCR sur l’appareil, mesures et exactitude.
        </p>
      </header>

      {journal.interrupted ? (
        <p className="alert" role="alert" data-testid="crash">
          {describeInterruption(journal.interrupted)}.
        </p>
      ) : null}

      <section aria-label="Capacités">
        <h2>Capacités</h2>
        <CapabilitiesSection value={capabilities} />
      </section>

      <section aria-label="Série">
        <h2>Série</h2>
        <div className="controls">
          <label>
            Configuration
            <select
              value={choice}
              disabled={state.running}
              onChange={(event) => setChoice(event.target.value)}
            >
              {ENGINE_CONFIGS.map((config) => (
                <option key={config.id} value={config.id}>
                  {config.label}
                </option>
              ))}
              <option value={ALL}>Toutes à la suite (7)</option>
            </select>
          </label>
          <label>
            Photos
            <select
              value={source}
              disabled={state.running}
              onChange={(event) =>
                setSource(event.target.value as SourceChoice)
              }
            >
              <option value="pack-50">Pack synthétique, 50 premières</option>
              <option value="pack-96">Pack synthétique, les 96</option>
              <option value="import">
                Photos importées ({state.imported.length})
              </option>
            </select>
          </label>
          <label className="button">
            Importer depuis la photothèque
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(event) => {
                controller.setImported(event.target.files ?? []);
                setSource('import');
              }}
            />
          </label>
          <p className="muted" data-testid="pack">
            Pack : {state.packError ?? `${state.pack.length} photos`}
          </p>
          <div className="row">
            <button
              type="button"
              className="primary"
              disabled={state.running}
              onClick={start}
            >
              Lancer
            </button>
            <button
              type="button"
              disabled={!state.running}
              onClick={() => controller.stop()}
            >
              Arrêter
            </button>
          </div>
        </div>
        {state.running ? (
          <div data-testid="progress">
            <progress
              value={progress?.index ?? 0}
              max={Math.max(1, progress?.total ?? 1)}
            />
            <p className="muted">
              {state.configId} ·{' '}
              {progress?.phase === 'loading'
                ? 'chargement du modèle…'
                : progress?.phase === 'warmup'
                  ? 'préchauffage…'
                  : `photo ${(progress?.index ?? 0) + 1} / ${progress?.total ?? 0}`}
            </p>
          </div>
        ) : null}
      </section>

      <section aria-label="Résultats">
        <h2>Résultats par configuration</h2>
        <ResultsTable results={latest} />
        <p className="muted">
          Pic mémoire : à relever dans l’Inspecteur web de Safari (Timeline,
          piste mémoire) pendant chaque série.
        </p>
      </section>

      <section aria-label="Dernière photo">
        <h2>Dernière photo</h2>
        {last ? (
          <div data-testid="last">
            <img src={last.url} alt="" className="thumb" />
            <p className="muted">
              {last.configId} · {last.record.name} ·{' '}
              {last.record.ok
                ? `${ms(last.record.totalMs)} ms, ${last.lines.length} lignes`
                : `échec : ${last.record.error}`}
            </p>
            {last.truth ? (
              <p>
                Attendu : <b>{last.truth.recipient ?? '(aucun)'}</b> /{' '}
                <b>{last.truth.sender ?? '(aucun)'}</b>
              </p>
            ) : null}
            {last.record.score?.recipient ? (
              <p data-testid="top3">
                Top 3 destinataire :{' '}
                {last.record.score.recipient.top
                  .map((match) => `${match.name} (${match.score.toFixed(2)})`)
                  .join(' · ') || 'aucun'}{' '}
                → {last.record.score.recipient.correct ? 'juste' : 'faux'}
                {last.record.score.sender
                  ? ` · expéditeur ${last.record.score.sender.correct ? 'juste' : 'faux'}`
                  : ''}
              </p>
            ) : null}
            <ol className="lines" data-testid="lines">
              {last.lines.map((line, index) => (
                <li key={index}>
                  {line.text}{' '}
                  <span className="muted">{line.score.toFixed(2)}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <p className="muted">Aucune photo traitée.</p>
        )}
      </section>

      <section aria-label="Journal">
        <h2>Journal</h2>
        <ul className="journal" data-testid="journal">
          {journal.entries
            .slice(-30)
            .reverse()
            .map((event, index) => (
              <li key={index}>
                <span className="muted">{clock(event.at)}</span> {event.name}
                {event.detail ? ` · ${event.detail}` : ''}
              </li>
            ))}
        </ul>
        <div className="row">
          <button
            type="button"
            className="primary"
            onClick={() =>
              void exportJson(journal, capabilities).then(setExported)
            }
          >
            Exporter le JSON
          </button>
          <button
            type="button"
            disabled={state.running}
            onClick={() => {
              journal.clearResults();
              controller.refresh();
            }}
          >
            Effacer les résultats
          </button>
        </div>
        {exported ? <p className="muted">JSON {exported}.</p> : null}
      </section>
    </main>
  );
}
