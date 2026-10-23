import { ENGINE_CONFIGS } from '#/engines/configs';
import type { OcrLine } from '#/engines/types';
import type { RunJournal } from '#/metrics/run-journal';
import type { PhotoResult, SeriesResult } from '#/metrics/types';
import { loadPack, importFiles } from '#/pack/pack';
import type { PhotoSource } from '#/pack/types';
import { buildDirectory } from '#/scoring/directory';
import { runSeries, type RunProgress } from '#/run/runner';

export type LastPhoto = {
  configId: string;
  record: PhotoResult;
  lines: OcrLine[];
  url: string;
  truth: PhotoSource['truth'];
};

export type ControllerState = {
  pack: PhotoSource[];
  packError: string | undefined;
  imported: PhotoSource[];
  running: boolean;
  configId: string | undefined;
  progress: RunProgress | undefined;
  last: LastPhoto | undefined;
  version: number;
};

export type StartRequest = {
  configIds: readonly string[];
  source: 'pack' | 'import';
  count: number;
};

export class Controller {
  private snapshot: ControllerState = {
    pack: [],
    packError: undefined,
    imported: [],
    running: false,
    configId: undefined,
    progress: undefined,
    last: undefined,
    version: 0,
  };
  private readonly listeners = new Set<() => void>();
  private stopRequested = false;
  private directory: string[] = [];

  constructor(
    readonly journal: RunJournal,
    private readonly baseUrl: string,
  ) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): ControllerState => this.snapshot;

  async loadPack(): Promise<void> {
    try {
      const pack = await loadPack(this.baseUrl);
      this.directory = buildDirectory(
        pack.flatMap((photo) => photo.truth?.recipient ?? []),
      );
      this.update({ pack, packError: undefined });
    } catch (error) {
      this.update({
        packError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  setImported(files: Iterable<File>): void {
    this.update({ imported: importFiles(files) });
  }

  refresh(): void {
    this.update({});
  }

  stop(): void {
    this.stopRequested = true;
  }

  async start(request: StartRequest): Promise<SeriesResult[]> {
    if (this.snapshot.running) throw new Error('une série est déjà en cours');
    const source = request.source;
    const photos =
      source === 'pack'
        ? this.snapshot.pack.slice(0, request.count)
        : this.snapshot.imported;
    if (photos.length === 0) throw new Error('aucune photo à traiter');
    this.stopRequested = false;
    this.update({ running: true });
    const results: SeriesResult[] = [];
    try {
      for (const configId of request.configIds) {
        if (this.stopRequested) break;
        this.update({ configId, progress: undefined });
        const result = await runSeries({
          configId,
          photos,
          source,
          directory: source === 'pack' ? this.directory : [],
          baseUrl: this.baseUrl,
          journal: this.journal,
          onProgress: (progress) => this.update({ progress }),
          onPhoto: (record, lines, blob) =>
            this.showLast(configId, record, lines, blob, photos),
          shouldStop: () => this.stopRequested,
        });
        results.push(result);
        this.update({});
      }
    } finally {
      this.update({ running: false, configId: undefined, progress: undefined });
    }
    return results;
  }

  private showLast(
    configId: string,
    record: PhotoResult,
    lines: OcrLine[],
    blob: Blob,
    photos: readonly PhotoSource[],
  ): void {
    const previous = this.snapshot.last;
    if (previous) URL.revokeObjectURL(previous.url);
    this.update({
      last: {
        configId,
        record,
        lines,
        url: URL.createObjectURL(blob),
        truth: photos.find((photo) => photo.id === record.id)?.truth,
      },
    });
  }

  private update(patch: Partial<ControllerState>): void {
    this.snapshot = {
      ...this.snapshot,
      ...patch,
      version: this.snapshot.version + 1,
    };
    for (const listener of this.listeners) listener();
  }
}

export const ALL_CONFIG_IDS = ENGINE_CONFIGS.map((config) => config.id);
