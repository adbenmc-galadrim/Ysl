import type { PackManifest, PhotoSource } from '#/pack/types';

export const PACK_DEFAULT_COUNT = 50;

export async function loadPack(base: string): Promise<PhotoSource[]> {
  const response = await fetch(`${base}corpus/manifest.json`);
  if (!response.ok) {
    throw new Error(`pack absent (HTTP ${response.status})`);
  }
  const manifest = (await response.json()) as PackManifest;
  return manifest.items.map((item) => ({
    id: item.id,
    name: item.file,
    truth: {
      carrier: item.carrier,
      recipient: item.recipient,
      sender: item.sender,
    },
    blob: async () => {
      const photo = await fetch(`${base}corpus/${item.file}`);
      if (!photo.ok) throw new Error(`${item.file} : HTTP ${photo.status}`);
      return photo.blob();
    },
  }));
}

export function importFiles(files: Iterable<File>): PhotoSource[] {
  return [...files].map((file, index) => ({
    id: `import-${String(index + 1).padStart(3, '0')}`,
    name: file.name,
    blob: () => Promise.resolve(file),
  }));
}
