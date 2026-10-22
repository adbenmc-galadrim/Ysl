import bwipjs from 'bwip-js/node';

export type Symbology =
  'code128' | 'datamatrix' | 'azteccode' | 'pdf417' | 'maxicode' | 'qrcode';

export const barcode = (bcid: Symbology, value: string) =>
  bwipjs.toBuffer({
    bcid,
    text: value,
    scale: 3,
    ...(bcid === 'code128' ? { height: 18, includetext: false } : {}),
    ...(bcid === 'maxicode' ? { mode: 2, parse: true } : {}),
  });
