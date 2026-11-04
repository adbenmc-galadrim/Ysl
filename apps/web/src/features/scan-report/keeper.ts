import { SCAN_REPORT_IMAGE_MAX_BYTES } from '@repo/contract/scan-report';
import type { ReportImage, ShotReadings, ShotText } from './report';

/** Tried in turn until the frame fits the server's 8 MiB. */
const QUALITIES = [0.92, 0.85, 0.75, 0.6] as const;

export type EncodedFrame = { blob: Blob; image: ReportImage };

/**
 * The frame the code readers had, full size, as a JPEG: the stored photo is
 * a 1 600 px copy and is not touched (D8 elsewhere). A frame still too heavy
 * at the lowest quality is shrunk rather than refused by the server (413):
 * its size then differs from the passes', whose positions stay in their own.
 */
export async function encodeFrame(
  frame: ImageBitmap,
  maxBytes = SCAN_REPORT_IMAGE_MAX_BYTES,
): Promise<EncodedFrame> {
  let width = frame.width;
  let height = frame.height;
  for (;;) {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is unavailable');
    context.drawImage(frame, 0, 0, width, height);
    let blob: Blob | null = null;
    for (const quality of QUALITIES) {
      blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
      if (blob.size <= maxBytes) {
        return {
          blob,
          image: {
            type: 'image/jpeg',
            width,
            height,
            bytes: blob.size,
            quality,
          },
        };
      }
    }
    if (Math.min(width, height) < 64) throw new Error('Frame does not fit');
    const scale = Math.sqrt(maxBytes / blob!.size) * 0.9;
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }
}

type Kept = ShotReadings & {
  frame: ImageBitmap | null;
  ocr: Promise<ShotText> | null;
};

/**
 * The last shot only: its frame and what each reader said. A new shot
 * closes the former frame, so the phone never holds more than one copy.
 */
export class ShotKeeper {
  private kept: Kept | null = null;

  keep(
    shot: Omit<ShotReadings, 'codes' | 'text'>,
    frame: ImageBitmap | null,
  ): void {
    this.drop();
    this.kept = {
      ...shot,
      codes: null,
      text: { state: 'none' },
      frame,
      ocr: null,
    };
  }

  codes(draftId: string, codes: NonNullable<ShotReadings['codes']>): void {
    if (this.kept?.draftId === draftId) this.kept.codes = codes;
  }

  text(draftId: string, reading: Promise<ShotText>): void {
    if (this.kept?.draftId !== draftId) return;
    const kept = this.kept;
    kept.text = { state: 'pending' };
    kept.ocr = reading.then((text) => {
      kept.text = text;
      return text;
    });
  }

  /** A shot can be reported once its codes are read, and while its frame is there. */
  has(): boolean {
    return this.kept?.frame != null && this.kept.codes !== null;
  }

  /**
   * Hands the shot over to one report: the text waited for up to `waitMs`,
   * then the keeper forgets it. The caller closes the frame.
   */
  async take(
    waitMs = 15_000,
  ): Promise<(ShotReadings & { frame: ImageBitmap }) | null> {
    const kept = this.kept;
    const frame = kept?.frame;
    if (!kept || !frame) return null;
    this.kept = null;
    if (kept.ocr) {
      await Promise.race([
        kept.ocr,
        new Promise((resolve) => setTimeout(resolve, waitMs)),
      ]);
    }
    return { ...kept, frame };
  }

  drop(): void {
    this.kept?.frame?.close();
    this.kept = null;
  }
}
