import { useEffect, useState } from 'react';
import { db } from '#/features/db/database';
import type { DraftParcel } from '#/features/db/schema';
import { photoFiles } from '#/features/photos/opfs';
import { readPhoto } from '#/features/photos/store';

/** Object URLs of the first drafts' photos, revoked when they leave. */
export function useDraftPhotos(
  drafts: readonly DraftParcel[],
  limit = drafts.length,
): Map<string, string> {
  const [urls, setUrls] = useState(() => new Map<string, string>());
  const wanted = drafts
    .slice(0, limit)
    .map((draft) => draft.photoId)
    .filter((id): id is string => id !== null)
    .join(',');
  useEffect(() => {
    if (!wanted) return;
    let cancelled = false;
    const created: string[] = [];
    const revoke = () => {
      for (const url of created.splice(0)) URL.revokeObjectURL(url);
    };
    void Promise.all(
      wanted.split(',').map(async (id) => {
        const photo = await db.photo.get(id);
        if (!photo) return undefined;
        const url = URL.createObjectURL(await readPhoto(photoFiles, photo));
        created.push(url);
        return [id, url] as const;
      }),
    ).then((entries) => {
      if (cancelled) revoke();
      else setUrls(new Map(entries.filter((e) => e !== undefined)));
    });
    return () => {
      cancelled = true;
      revoke();
    };
  }, [wanted]);
  return urls;
}
