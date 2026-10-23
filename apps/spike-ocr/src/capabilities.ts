export type GpuInfo = {
  vendor: string;
  architecture: string;
  device: string;
  description: string;
};

export type Capabilities = {
  userAgent: string;
  crossOriginIsolated: boolean;
  sharedArrayBuffer: boolean;
  webgpu: boolean;
  gpu: GpuInfo | { error: string } | undefined;
  hardwareConcurrency: number;
  wasmThreads: number;
  deviceMemoryGb: number | undefined;
  screen: string;
};

type GpuAdapter = { info?: Partial<GpuInfo> };
type GpuNavigator = Navigator & {
  gpu?: { requestAdapter(): Promise<GpuAdapter | null> };
  deviceMemory?: number;
};

const MAX_WASM_THREADS = 4;

export function wasmThreadCount(
  isolated: boolean,
  hardwareConcurrency: number,
): number {
  if (!isolated) return 1;
  return Math.max(1, Math.min(MAX_WASM_THREADS, hardwareConcurrency));
}

export async function readGpu(nav: GpuNavigator): Promise<Capabilities['gpu']> {
  if (!nav.gpu) return undefined;
  try {
    const adapter = await nav.gpu.requestAdapter();
    if (!adapter) return { error: 'aucun adaptateur WebGPU' };
    const info = adapter.info ?? {};
    return {
      vendor: info.vendor ?? '',
      architecture: info.architecture ?? '',
      device: info.device ?? '',
      description: info.description ?? '',
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function readCapabilities(): Promise<Capabilities> {
  const nav = navigator as GpuNavigator;
  const isolated = globalThis.crossOriginIsolated === true;
  return {
    userAgent: nav.userAgent,
    crossOriginIsolated: isolated,
    sharedArrayBuffer: typeof SharedArrayBuffer === 'function',
    webgpu: nav.gpu !== undefined,
    gpu: await readGpu(nav),
    hardwareConcurrency: nav.hardwareConcurrency,
    wasmThreads: wasmThreadCount(isolated, nav.hardwareConcurrency),
    deviceMemoryGb: nav.deviceMemory,
    screen: `${screen.width}×${screen.height} @${window.devicePixelRatio}x`,
  };
}
