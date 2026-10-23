import type { Capabilities } from '#/capabilities';
import type { RunJournal } from '#/metrics/run-journal';
import { seriesStats } from '#/metrics/stats';

export function buildExport(
  journal: RunJournal,
  capabilities: Capabilities | undefined,
) {
  return {
    exportedAt: new Date().toISOString(),
    capabilities,
    interrupted: journal.interrupted,
    series: journal.history.map((series) => ({
      ...series,
      stats: seriesStats(series.photos),
    })),
    events: journal.entries,
  };
}

export async function exportJson(
  journal: RunJournal,
  capabilities: Capabilities | undefined,
): Promise<string> {
  const name = `spike-s3-${Date.now()}.json`;
  const file = new File(
    [JSON.stringify(buildExport(journal, capabilities), null, 2)],
    name,
    { type: 'application/json' },
  );
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
}
