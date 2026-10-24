import { BarcodeDecoder } from '@repo/barcode/worker';
import { DecodeQueue, queueFor } from '#/features/scan/decode-queue';

let queue: DecodeQueue | undefined;

/**
 * The Worker behind the scan screen, started on first use and kept for the
 * session like the camera: a reading in flight when the agent leaves the
 * screen still lands in its draft.
 */
export function decodeQueue(): DecodeQueue {
  queue ??= queueFor(new BarcodeDecoder());
  return queue;
}
