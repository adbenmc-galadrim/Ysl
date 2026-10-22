const START_OF_IMAGE = 0xffd8;
const START_OF_SCAN = 0xffda;
const APP1 = 0xffe1;
const EXIF_HEADER = 0x45786966;
const LITTLE_ENDIAN = 0x4949;
const BIG_ENDIAN = 0x4d4d;
const TIFF_MAGIC = 42;
const ORIENTATION_TAG = 0x0112;
const IFD_ENTRY_SIZE = 12;

function readTiffOrientation(view: DataView, tiff: number): number | undefined {
  if (tiff + 8 > view.byteLength) return undefined;
  const order = view.getUint16(tiff);
  if (order !== LITTLE_ENDIAN && order !== BIG_ENDIAN) return undefined;
  const little = order === LITTLE_ENDIAN;
  if (view.getUint16(tiff + 2, little) !== TIFF_MAGIC) return undefined;
  const ifd = tiff + view.getUint32(tiff + 4, little);
  if (ifd + 2 > view.byteLength) return undefined;
  const count = view.getUint16(ifd, little);
  for (let index = 0; index < count; index++) {
    const entry = ifd + 2 + index * IFD_ENTRY_SIZE;
    if (entry + IFD_ENTRY_SIZE > view.byteLength) return undefined;
    if (view.getUint16(entry, little) === ORIENTATION_TAG) {
      const value = view.getUint16(entry + 8, little);
      return value >= 1 && value <= 8 ? value : undefined;
    }
  }
  return undefined;
}

export function readOrientation(buffer: ArrayBuffer): number | undefined {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== START_OF_IMAGE) {
    return undefined;
  }
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset);
    if (marker >> 8 !== 0xff || marker === START_OF_SCAN) return undefined;
    const length = view.getUint16(offset + 2);
    const data = offset + 4;
    if (
      marker === APP1 &&
      data + 6 <= view.byteLength &&
      view.getUint32(data) === EXIF_HEADER &&
      view.getUint16(data + 4) === 0
    ) {
      return readTiffOrientation(view, data + 6);
    }
    offset += 2 + length;
  }
  return undefined;
}
