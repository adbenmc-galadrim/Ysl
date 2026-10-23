import { useEffect, useState } from 'react';
import { readCapabilities, type Capabilities } from '#/capabilities';
import { appBase } from '#/base';
import { ENGINE_CONFIGS } from '#/engines/configs';
import type { OcrLine } from '#/engines/types';
import { OcrClient } from '#/worker/client';
import { importFiles, loadPack } from '#/pack/pack';
import type { PhotoSource } from '#/pack/types';

function yesNo(value: boolean): string {
  return value ? 'oui' : 'non';
}

function gpuLabel(gpu: Capabilities['gpu']): string {
  if (!gpu) return 'aucun';
  if ('error' in gpu) return `échec : ${gpu.error}`;
  const parts = [gpu.vendor, gpu.architecture, gpu.device, gpu.description];
  return parts.filter(Boolean).join(' · ') || 'adaptateur sans description';
}

export function App() {
  const [capabilities, setCapabilities] = useState<Capabilities>();
  const [pack, setPack] = useState<PhotoSource[]>([]);
  const [packError, setPackError] = useState<string>();
  const [imported, setImported] = useState<PhotoSource[]>([]);
  const [configId, setConfigId] = useState(ENGINE_CONFIGS[0]?.id ?? '');
  const [trial, setTrial] = useState<string>();
  const [lines, setLines] = useState<OcrLine[]>([]);

  const runTrial = async () => {
    const photo = [...imported, ...pack][0];
    if (!photo) return;
    const client = new OcrClient(`${location.origin}${appBase}`);
    setLines([]);
    setTrial('chargement…');
    try {
      const loaded = await client.load(configId);
      if (loaded.type !== 'loaded') {
        setTrial(
          loaded.type === 'load-failed' ? `échec : ${loaded.error}` : '?',
        );
        return;
      }
      const warmed = await client.warmup();
      if (warmed.type !== 'warmed') {
        setTrial(
          `échec du préchauffage : ${warmed.type === 'failed' ? warmed.error : '?'}`,
        );
        return;
      }
      const result = await client.recognize(await photo.blob());
      setLines(result.lines);
      setTrial(
        `chargement ${Math.round(loaded.loadMs)} ms · préparation ${Math.round(result.timings.prepMs)} ms · OCR ${Math.round(result.timings.ocrMs)} ms · ${result.lines.length} lignes`,
      );
    } catch (error) {
      setTrial(
        `échec : ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      client.terminate();
    }
  };

  useEffect(() => {
    void readCapabilities().then(setCapabilities);
    loadPack(appBase).then(setPack, (error: unknown) =>
      setPackError(error instanceof Error ? error.message : String(error)),
    );
  }, []);

  return (
    <main className="app">
      <header>
        <h1>Spike S3 · OCR</h1>
        <p className="muted">
          Moteurs OCR sur l’appareil, mesures et exactitude.
        </p>
      </header>
      <section aria-label="Capacités">
        <h2>Capacités</h2>
        {capabilities ? (
          <dl className="capabilities">
            <dt>crossOriginIsolated</dt>
            <dd data-testid="isolated">
              {yesNo(capabilities.crossOriginIsolated)}
            </dd>
            <dt>SharedArrayBuffer</dt>
            <dd>{yesNo(capabilities.sharedArrayBuffer)}</dd>
            <dt>WebGPU</dt>
            <dd data-testid="webgpu">{yesNo(capabilities.webgpu)}</dd>
            <dt>Adaptateur WebGPU</dt>
            <dd>{gpuLabel(capabilities.gpu)}</dd>
            <dt>Cœurs</dt>
            <dd>{capabilities.hardwareConcurrency}</dd>
            <dt>Threads WASM</dt>
            <dd data-testid="threads">{capabilities.wasmThreads}</dd>
            <dt>Mémoire déclarée</dt>
            <dd>
              {capabilities.deviceMemoryGb === undefined
                ? 'non exposée'
                : `${capabilities.deviceMemoryGb} Go`}
            </dd>
            <dt>Écran</dt>
            <dd>{capabilities.screen}</dd>
            <dt>Navigateur</dt>
            <dd>{capabilities.userAgent}</dd>
          </dl>
        ) : (
          <p className="muted">Lecture des capacités…</p>
        )}
      </section>
      <section aria-label="Photos">
        <h2>Photos</h2>
        <p data-testid="pack">
          Pack synthétique : {packError ?? `${pack.length} photos`}
        </p>
        <label className="button">
          Importer depuis la photothèque
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) =>
              setImported(importFiles(event.target.files ?? []))
            }
          />
        </label>
        <p className="muted" data-testid="imported">
          {imported.length} photo(s) importée(s)
        </p>
      </section>
      <section aria-label="Essai">
        <h2>Essai sur une photo</h2>
        <select
          value={configId}
          onChange={(event) => setConfigId(event.target.value)}
        >
          {ENGINE_CONFIGS.map((config) => (
            <option key={config.id} value={config.id}>
              {config.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="primary"
          onClick={() => void runTrial()}
        >
          Lancer
        </button>
        <p className="muted" data-testid="trial">
          {trial}
        </p>
        <ol data-testid="lines">
          {lines.map((line, index) => (
            <li key={index}>{line.text}</li>
          ))}
        </ol>
      </section>
    </main>
  );
}
