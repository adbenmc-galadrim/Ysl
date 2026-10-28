/** The pen of the pad (`SignaturePad`): its width, in the pad's pixels. */
const STROKE_WIDTH = 3.5;
/** Room around the ink, so the round caps are not cut. */
const MARGIN = 8;

export type SignatureImage = { blob: Blob; width: number; height: number };

type Box = { minX: number; minY: number; maxX: number; maxY: number };

/**
 * The box the strokes' points span. Every number of the path data the pad
 * writes (`M`, `L`, `Q`, `C`) goes by pairs of coordinates, so the points
 * read without parsing the commands.
 */
export function strokesBox(strokes: readonly string[]): Box | null {
  let box: Box | null = null;
  for (const d of strokes) {
    const numbers = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    for (let i = 0; i + 1 < numbers.length; i += 2) {
      const x = numbers[i]!;
      const y = numbers[i + 1]!;
      box = box
        ? {
            minX: Math.min(box.minX, x),
            minY: Math.min(box.minY, y),
            maxX: Math.max(box.maxX, x),
            maxY: Math.max(box.maxY, y),
          }
        : { minX: x, minY: y, maxX: x, maxY: y };
    }
  }
  return box;
}

/**
 * The signature as kept on the iPhone (YSL-75): a PNG of the ink only,
 * cropped to the strokes, black on transparent, at twice the pad's pixels
 * so it stays sharp on a Retina screen. A few kilobytes.
 */
export async function strokesToPng(
  strokes: readonly string[],
  scale = 2,
): Promise<SignatureImage> {
  const box = strokesBox(strokes);
  if (!box) throw new Error('No stroke to draw');
  const width = Math.ceil((box.maxX - box.minX + 2 * MARGIN) * scale);
  const height = Math.ceil((box.maxY - box.minY + 2 * MARGIN) * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No 2D canvas');
  context.scale(scale, scale);
  context.translate(MARGIN - box.minX, MARGIN - box.minY);
  context.strokeStyle = '#000';
  context.lineWidth = STROKE_WIDTH;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (const d of strokes) context.stroke(new Path2D(d));
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  );
  if (!blob) throw new Error('The signature could not be encoded');
  return { blob, width, height };
}
