import type { PackItem, PackManifest, PhotoSource } from '#/pack/types';

export const PACK_DEFAULT_COUNT = 50;

function isPackItem(value: unknown): value is PackItem {
  const item = value as Partial<PackItem> | null;
  return (
    typeof item?.id === 'string' &&
    typeof item.file === 'string' &&
    typeof item.carrier === 'string'
  );
}

function parseManifest(value: unknown): PackManifest {
  const manifest = value as Partial<PackManifest> | null;
  if (!Array.isArray(manifest?.items) || !manifest.items.every(isPackItem)) {
    throw new Error('manifeste du pack invalide');
  }
  return manifest as PackManifest;
}

export async function loadPack(base: string): Promise<PhotoSource[]> {
  const response = await fetch(`${base}corpus/manifest.json`);
  if (!response.ok) {
    throw new Error(`pack absent (HTTP ${response.status})`);
  }
  const manifest = parseManifest(await response.json());
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
