import { useEffect, useState } from 'react';
import { db } from '#/features/db/database';
import type { DraftOcrLine, LocalPhoto } from '#/features/db/schema';
import type { AnnexField } from '#/features/review/model';
import { photoFiles } from '#/features/photos/opfs';
import { readPhoto } from '#/features/photos/store';

export type ShownPhoto = { photo: LocalPhoto; url: string };

/** The photo of the draft as an object URL, released when the draft changes. */
export function usePhoto(
  photoId: string | null | undefined,
): ShownPhoto | undefined {
  const [shown, setShown] = useState<ShownPhoto>();
  useEffect(() => {
    if (!photoId) return;
    let url: string | undefined;
    let current = true;
    void (async () => {
      const photo = await db.photo.get(photoId);
      if (!photo) return;
      const blob = await readPhoto(photoFiles, photo).catch(() => null);
      if (!blob || !current) return;
      url = URL.createObjectURL(blob);
      setShown({ photo, url });
    })();
    return () => {
      current = false;
      setShown(undefined);
      if (url) URL.revokeObjectURL(url);
    };
  }, [photoId]);
  return shown;
}

const compact = (text: string) => text.replace(/[\s-]/g, '').toUpperCase();

/**
 * The printed line the number sits on, to crop the photo around it: the
 * whole number, else its last six characters; none when it was not printed
 * or not read.
 */
export function trackingLine(
  lines: readonly DraftOcrLine[],
  value: string | null,
): DraftOcrLine | null {
  if (!value) return null;
  const wanted = compact(value);
  const tail = wanted.slice(-6);
  return (
    lines.find((line) => compact(line.text).includes(wanted)) ??
    lines.find(
      (line) => tail.length === 6 && compact(line.text).includes(tail),
    ) ??
    null
  );
}

const PRINTED: Record<AnnexField, RegExp | null> = {
  weightKg: /\d\s*(?:KG|LBS?)\b/i,
  pieces: /\b\d{1,2}\s*(?:\/|OF|SUR)\s*\d{1,2}\b/i,
  service: null,
  reference: null,
};

/**
 * The printed line an annex field was read on: the weight next to its unit,
 * « 1 OF 3 », else the line holding the value as read.
 */
export function annexLine(
  lines: readonly DraftOcrLine[],
  field: AnnexField,
  read: string,
): DraftOcrLine | null {
  const printed = PRINTED[field];
  const wanted = compact(read);
  return (
    (printed && lines.find((line) => printed.test(line.text))) ||
    (wanted.length > 1
      ? lines.find((line) => compact(line.text).includes(wanted))
      : undefined) ||
    null
  );
}
