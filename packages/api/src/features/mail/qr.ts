import { deflateSync } from 'node:zlib';
import { encode } from 'uqr';
import type { EmailAttachment } from '@repo/db/schema';

const QUIET_ZONE = 4;
const MODULE_PX = 8;
const CELL_PX = 4;

export const QR_FILE_NAME = 'code-de-retrait.png';

/** The modules of a pickup QR with its quiet zone, as `@repo/ui` draws them on the iPhone. */
export function qrModules(token: string): boolean[][] {
  const { data } = encode(token, { ecc: 'M', border: 0 });
  const size = data.length + 2 * QUIET_ZONE;
  const blank = () => Array.from({ length: QUIET_ZONE }, () => false);
  const edge = () =>
    Array.from({ length: QUIET_ZONE }, () =>
      Array.from({ length: size }, () => false),
    );
  return [
    ...edge(),
    ...data.map((row) => [...blank(), ...row, ...blank()]),
    ...edge(),
  ];
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(bytes: Buffer): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, tail]);
}

/** A grey-scale PNG of the modules: nothing else in the server draws, a dependency would be for this only. */
export function qrPng(modules: readonly (readonly boolean[])[]): Buffer {
  const size = modules.length * MODULE_PX;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  const rows = modules.flatMap((row) => {
    const line = Buffer.from([
      0,
      ...row.flatMap((dark) =>
        Array.from({ length: MODULE_PX }, () => (dark ? 0 : 255)),
      ),
    ]);
    return Array.from({ length: MODULE_PX }, () => line);
  });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function qrAttachment(token: string): EmailAttachment {
  return {
    name: QR_FILE_NAME,
    contentBase64: qrPng(qrModules(token)).toString('base64'),
  };
}

/**
 * The QR as a table of cells: Gmail drops `data:` images and clients hold back
 * remote ones, a table shows at once. Runs share a cell: Gmail cuts a mail past 102 KB.
 */
export function qrTable(modules: readonly (readonly boolean[])[]): string {
  const rows = modules.map((row) => {
    const cells: string[] = [];
    let start = 0;
    for (let x = 1; x <= row.length; x += 1) {
      if (x < row.length && row[x] === row[start]) continue;
      const span = x - start;
      const color = row[start] ? '#000000' : '#ffffff';
      cells.push(
        `<td colspan="${span}" width="${span * CELL_PX}" height="${CELL_PX}" bgcolor="${color}" style="background:${color};font-size:0;line-height:0"></td>`,
      );
      start = x;
    }
    return `<tr>${cells.join('')}</tr>`;
  });
  return `<table role="img" aria-label="QR" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#ffffff">${rows.join('')}</table>`;
}
