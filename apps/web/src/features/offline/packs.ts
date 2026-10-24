import type { TranslateFn } from '@repo/shared/i18n';
import type { OfflineDownload, OfflinePack } from '@repo/ui';
import { formatBytes } from '#/features/db/storage';
import type { DownloadProgress } from '#/features/offline/download';
import type { SyncRunStatus } from '#/features/sync/engine';

export type PackState = OfflineDownload['state'];

export type DirectoryInput = {
  online: boolean;
  status: SyncRunStatus;
  /** The first pull went through: the directory is on the device. */
  hasCursor: boolean;
  persons: number;
};

export type ModelsSnapshot = {
  state: PackState;
  progress: DownloadProgress;
};

export type ShellSnapshot = {
  state: PackState;
  bytes: number | null;
};

export type PrepInput = {
  directory: DirectoryInput;
  models: ModelsSnapshot;
  shell: ShellSnapshot;
};

export type PrepView = {
  downloads: OfflineDownload[];
  allDone: boolean;
  /** At least one pack stopped: the screen offers to resume or to start anyway. */
  paused: boolean;
  /** What the reader still needs, for the resume button; null when unknown. */
  remainingBytes: number | null;
};

const PACKS = (t: TranslateFn) =>
  ({
    directory: {
      id: 'directory',
      icon: 'users',
      title: t('prep.pack.directory'),
    },
    reader: { id: 'reader', icon: 'scan', title: t('prep.pack.reader') },
    shell: { id: 'shell', icon: 'image', title: t('prep.pack.shell') },
  }) satisfies Record<string, Omit<OfflinePack, 'detail'>>;

const pack = (
  base: Omit<OfflinePack, 'detail'>,
  detail: string,
): OfflinePack => ({
  ...base,
  detail,
});

const paused = (t: TranslateFn, detail: string) =>
  t('prep.detail.paused', { detail });

function directoryRow(
  { online, status, hasCursor, persons }: DirectoryInput,
  t: TranslateFn,
): OfflineDownload {
  const base = PACKS(t).directory;
  if (hasCursor) {
    const detail =
      persons === 1
        ? t('prep.pack.directory.one')
        : t('prep.pack.directory.many', { count: persons });
    return { pack: pack(base, detail), state: 'done', progress: 1 };
  }
  const stopped = !online || status === 'offline' || status === 'error';
  const detail = t('prep.detail.downloading');
  return stopped
    ? { pack: pack(base, paused(t, detail)), state: 'paused', progress: 0 }
    : { pack: pack(base, detail), state: 'running', progress: 0 };
}

function fractionOf({ bytes, total, files, filesDone }: DownloadProgress) {
  if (total !== null && total > 0) return Math.min(1, bytes / total);
  return files === 0 ? 1 : filesDone / files;
}

function modelsRow({ state, progress }: ModelsSnapshot, t: TranslateFn) {
  const base = PACKS(t).reader;
  if (state === 'done') {
    const size = progress.total ?? progress.bytes;
    return {
      pack: pack(base, formatBytes(size)),
      state,
      progress: 1,
    } satisfies OfflineDownload;
  }
  const detail =
    progress.total !== null
      ? t('prep.detail.bytesOf', {
          done: formatBytes(progress.bytes),
          total: formatBytes(progress.total),
        })
      : t('prep.detail.filesOf', {
          done: progress.filesDone,
          total: progress.files,
        });
  return {
    pack: pack(base, state === 'paused' ? paused(t, detail) : detail),
    state,
    progress: fractionOf(progress),
  } satisfies OfflineDownload;
}

function shellRow({ state, bytes }: ShellSnapshot, t: TranslateFn) {
  const base = PACKS(t).shell;
  if (state === 'done') {
    const detail =
      bytes === null ? t('prep.detail.installed') : formatBytes(bytes);
    return {
      pack: pack(base, detail),
      state,
      progress: 1,
    } satisfies OfflineDownload;
  }
  const detail = t('prep.detail.installing');
  return {
    pack: pack(base, state === 'paused' ? paused(t, detail) : detail),
    state,
    progress: 0,
  } satisfies OfflineDownload;
}

/** The three rows of the screen, from what each source says. */
export function derivePacks(input: PrepInput, t: TranslateFn): PrepView {
  const downloads = [
    directoryRow(input.directory, t),
    modelsRow(input.models, t),
    shellRow(input.shell, t),
  ];
  const { total, bytes } = input.models.progress;
  return {
    downloads,
    allDone: downloads.every((download) => download.state === 'done'),
    paused: downloads.some((download) => download.state === 'paused'),
    remainingBytes:
      input.models.state === 'done' || total === null
        ? null
        : Math.max(0, total - bytes),
  };
}
