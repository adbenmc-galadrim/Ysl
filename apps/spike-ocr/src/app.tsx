import { useEffect, useState } from 'react';
import { readCapabilities, type Capabilities } from '#/capabilities';

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

  useEffect(() => {
    void readCapabilities().then(setCapabilities);
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
    </main>
  );
}
