import type { Journal } from '#/journal';

export async function exportJournal(journal: Journal): Promise<string> {
  const payload = { exportedAt: new Date().toISOString(), ...journal.toJSON() };
  const name = `spike-s5-${Date.now()}.json`;
  const file = new File([JSON.stringify(payload, null, 2)], name, {
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
}
