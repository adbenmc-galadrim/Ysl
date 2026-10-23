import type { Device } from '#/device';
import { rates, type Journal } from '#/journal';

export const buildExport = (
  journal: Journal,
  device: Device = journal.device,
) => ({
  exportedAt: new Date().toISOString(),
  device,
  byMode: rates(journal.trials, (t) => t.mode),
  byCarrier: rates(journal.trials, (t) => t.carrier),
  trials: journal.trials,
  events: journal.events,
});

export const exportName = () => `spike-s2-${Date.now()}.json`;

export const exportJournal = async (journal: Journal): Promise<string> => {
  const name = exportName();
  const file = new File([JSON.stringify(buildExport(journal), null, 2)], name, {
    type: 'application/json',
  });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: name });
    return 'partagé';
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'téléchargé';
};
