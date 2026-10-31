import { encodePhoto } from '#/features/camera/capture';
import type { ProofInput } from '#/features/handover/proofs';
import { readImageFile } from '#/features/scan/read-file';

/** The photo of the handover as kept: upright, 1 600 px, JPEG without EXIF. */
export async function photoProof(file: File): Promise<ProofInput> {
  const bitmap = await readImageFile(file);
  try {
    return { kind: 'photo', ...(await encodePhoto(bitmap)) };
  } finally {
    bitmap.close();
  }
}
