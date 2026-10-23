export type GeneratedPhoto = { blob: Blob; sha256: string };

type Context2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

type Surface = {
  context: Context2D;
  source: CanvasImageSource;
  toBlob: (type: string, quality: number) => Promise<Blob>;
};

const WIDTH = 3000;
const HEIGHT = 4000;
const NOISE_WIDTH = 340;
const NOISE_HEIGHT = 460;
const QUALITY = 0.9;
const RANDOM_CHUNK = 65536;

function createSurface(width: number, height: number): Surface {
  if (
    typeof OffscreenCanvas !== 'undefined' &&
    'convertToBlob' in OffscreenCanvas.prototype
  ) {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Contexte 2D indisponible');
    return {
      context,
      source: canvas,
      toBlob: (type, quality) => canvas.convertToBlob({ type, quality }),
    };
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Contexte 2D indisponible');
  return {
    context,
    source: canvas,
    toBlob: (type, quality) =>
      new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('toBlob vide'))),
          type,
          quality,
        );
      }),
  };
}

function noise(): ImageData {
  const image = new ImageData(NOISE_WIDTH, NOISE_HEIGHT);
  for (let offset = 0; offset < image.data.length; offset += RANDOM_CHUNK) {
    crypto.getRandomValues(image.data.subarray(offset, offset + RANDOM_CHUNK));
  }
  for (let index = 3; index < image.data.length; index += 4) {
    image.data[index] = 255;
  }
  return image;
}

export async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    await blob.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export async function generatePhoto(seq: number): Promise<GeneratedPhoto> {
  const tile = createSurface(NOISE_WIDTH, NOISE_HEIGHT);
  tile.context.putImageData(noise(), 0, 0);
  const { context, toBlob } = createSurface(WIDTH, HEIGHT);
  context.drawImage(tile.source, 0, 0, WIDTH, HEIGHT);
  context.fillStyle = 'rgba(255, 255, 255, 0.85)';
  context.fillRect(0, HEIGHT / 2 - 500, WIDTH, 1000);
  context.fillStyle = '#111';
  context.font = 'bold 700px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(`n° ${seq}`, WIDTH / 2, HEIGHT / 2);
  const blob = await toBlob('image/jpeg', QUALITY);
  return { blob, sha256: await sha256Hex(blob) };
}

export function photoNameFor(
  sessionId: string,
  seq: number,
  attempt: number,
): string {
  return `${sessionId}-${seq}-${attempt}.jpg`;
}

export function seqFromPhotoName(name: string): number | undefined {
  const match = /-(\d+)-\d+\.jpg$/.exec(name);
  return match?.[1] === undefined ? undefined : Number(match[1]);
}
