import { encodeQr } from '@repo/ui';

/** White modules around the code, as the QR standard asks for a reader to lock on. */
const QUIET_ZONE = 4;

/** Pixels per module: sharp in Mail on a Retina screen, a few kilobytes of PNG. */
const MODULE_PX = 12;

/**
 * The modules of the pickup QR with its quiet zone, rows top to bottom, true
 * for dark. Level M: no logo over it, and the token stays a small code
 * (version 3) a phone camera reads off another phone's screen at the desk.
 */
export function pickupQrModules(token: string): boolean[][] {
  const rows = encodeQr(token, 'M');
  const size = rows.length + 2 * QUIET_ZONE;
  const blank = () => Array.from({ length: size }, () => false);
  return [
    ...Array.from({ length: QUIET_ZONE }, blank),
    ...rows.map((row) => [
      ...Array.from({ length: QUIET_ZONE }, () => false),
      ...[...row].map((cell) => cell === '#'),
      ...Array.from({ length: QUIET_ZONE }, () => false),
    ]),
    ...Array.from({ length: QUIET_ZONE }, blank),
  ];
}

/**
 * The QR as a PNG file to share with the mail. Drawn in memory for the page
 * on screen, never stored: the token it carries lives in the mail only.
 */
export async function pickupQrFile(
  token: string,
  name = 'code-de-retrait.png',
): Promise<File> {
  const modules = pickupQrModules(token);
  const size = modules.length * MODULE_PX;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No 2D canvas to draw the pickup QR');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, size, size);
  context.fillStyle = '#000';
  modules.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark)
        context.fillRect(x * MODULE_PX, y * MODULE_PX, MODULE_PX, MODULE_PX);
    }),
  );
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  );
  if (!blob) throw new Error('The pickup QR could not be encoded as PNG');
  return new File([blob], name, { type: 'image/png' });
}
