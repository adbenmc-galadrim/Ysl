export const PHOTOS_DIRECTORY = 'captures';

export type SaveRequest = { id: number; name: string; blob: Blob };
export type SaveReply =
  { id: number; ok: true } | { id: number; ok: false; error: string };

type Pending = { resolve: () => void; reject: (error: Error) => void };

let worker: Worker | undefined;
let nextId = 0;
const pending = new Map<number, Pending>();

function writer(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./opfs-worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.addEventListener('message', (event: MessageEvent<SaveReply>) => {
      const reply = event.data;
      const request = pending.get(reply.id);
      pending.delete(reply.id);
      if (!request) return;
      if (reply.ok) request.resolve();
      else request.reject(new Error(reply.error));
    });
  }
  return worker;
}

export function savePhoto(name: string, blob: Blob): Promise<void> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    writer().postMessage({ id, name, blob } satisfies SaveRequest);
  });
}

export async function clearPhotos(): Promise<void> {
  const root = await navigator.storage.getDirectory();
  try {
    await root.removeEntry(PHOTOS_DIRECTORY, { recursive: true });
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'NotFoundError')) {
      throw error;
    }
  }
}
