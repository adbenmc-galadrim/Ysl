import type { PaddleModelId } from '#/engines/paths';
import type { Backend, EngineConfig } from '#/engines/types';

const PADDLE_MODELS: { model: PaddleModelId; label: string }[] = [
  { model: 'v5-mobile', label: 'PP-OCRv5 mobile (latin)' },
  { model: 'v6-tiny', label: 'PP-OCRv6 tiny' },
  { model: 'v6-small', label: 'PP-OCRv6 small' },
];

const BACKENDS: { backend: Backend; label: string }[] = [
  { backend: 'webgpu', label: 'WebGPU' },
  { backend: 'wasm', label: 'WASM' },
];

export const ENGINE_CONFIGS: readonly EngineConfig[] = [
  ...PADDLE_MODELS.flatMap(({ model, label }) =>
    BACKENDS.map(({ backend, label: backendLabel }): EngineConfig => ({
      id: `paddle-${model}-${backend}`,
      label: `${label} · ${backendLabel}`,
      family: 'paddle',
      model,
      backend,
    })),
  ),
  {
    id: 'tesseract-v7-wasm',
    label: 'Tesseract.js v7 · fra+eng · WASM',
    family: 'tesseract',
    backend: 'wasm',
  },
];

export function findConfig(id: string): EngineConfig {
  const config = ENGINE_CONFIGS.find((candidate) => candidate.id === id);
  if (!config) throw new Error(`configuration inconnue : ${id}`);
  return config;
}
