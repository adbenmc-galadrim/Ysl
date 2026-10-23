import { encode } from 'uqr';

/** Share of the drawing left white around the modules. */
export const QR_MARGIN = 0.08;

/** Share of the drawing the logo takes, centred on the code. */
export const QR_LOGO = 0.2;

/**
 * The modules of a QR code for `value`, rows top to bottom, `#` for dark and
 * `.` for light, without quiet zone. Error correction is level H, the only
 * one that still reads with a logo over the centre.
 */
export function encodeQr(value: string): string[] {
  const { data } = encode(value, { ecc: 'H', border: 0 });
  return data.map((row) => row.map((dark) => (dark ? '#' : '.')).join(''));
}

/**
 * The first and past-the-last module, on both axes, of the square a centred
 * logo covers in a code of `size` modules drawn with `QR_MARGIN`.
 */
export function qrLogoArea(size: number): [number, number] {
  const pitch = (1 - 2 * QR_MARGIN) / size;
  const from = (0.5 - QR_LOGO / 2 - QR_MARGIN) / pitch;
  const to = (0.5 + QR_LOGO / 2 - QR_MARGIN) / pitch;
  return [Math.floor(from), Math.ceil(to)];
}
