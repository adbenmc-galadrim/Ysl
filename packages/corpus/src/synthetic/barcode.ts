import bwipjs from 'bwip-js/node';

export type Symbology =
  'code128' | 'datamatrix' | 'azteccode' | 'pdf417' | 'maxicode' | 'qrcode';

const CONTROL = /\p{Cc}|\^/gu;
const HAS_CONTROL = /\p{Cc}|\^/u;

/** bwip-js reads control characters as `^NNN` escapes when `parse` is set. */
const escaped = (value: string) =>
  value.replace(
    CONTROL,
    (char) => `^${String(char.charCodeAt(0)).padStart(3, '0')}`,
  );

export const barcode = (bcid: Symbology, value: string) => {
  const parse = HAS_CONTROL.test(value);
  return bwipjs.toBuffer({
    bcid,
    text: parse ? escaped(value) : value,
    scale: 3,
    ...(parse ? { parse: true } : {}),
    ...(bcid === 'code128' ? { height: 18, includetext: false } : {}),
    ...(bcid === 'maxicode' ? { mode: 2 } : {}),
  });
};
