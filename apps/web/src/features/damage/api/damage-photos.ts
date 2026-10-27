import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '#/features/db/database';
import { findDamagePhotos } from '#/features/damage/report';
import { photoFiles } from '#/features/photos/opfs';
import { readPhoto } from '#/features/photos/store';

export type DamagePhotoUrl = { id: string; url: string };

/**
 * Object URLs of the photos of the reserve the parcel carries, read from
 * OPFS: `undefined` while they are read, empty when none is on this iPhone
 * (taken on another one, D8). Revoked when the record closes.
 */
export function useDamagePhotoUrls(
  parcelId: string,
  since: Date | null,
): DamagePhotoUrl[] | undefined {
  const sinceTime = since?.getTime() ?? null;
  const ids = useLiveQuery(
    async () =>
      sinceTime === null
        ? []
        : (await findDamagePhotos(db, parcelId, new Date(sinceTime))).map(
            (photo) => photo.id,
          ),
    [parcelId, sinceTime],
  );
  const key = ids?.join(',');
  const [urls, setUrls] = useState<DamagePhotoUrl[] | undefined>();
  useEffect(() => {
    if (key === undefined) return;
    const wanted = key ? key.split(',') : [];
    const made: string[] = [];
    let live = true;
    void Promise.all(
      wanted.map(async (id) => {
        const photo = await db.photo.get(id);
        if (!photo) return null;
        try {
          const blob = await readPhoto(photoFiles, photo);
          if (!live) return null;
          const url = URL.createObjectURL(blob);
          made.push(url);
          return { id, url };
        } catch {
          return null;
        }
      }),
    ).then((read) => {
      if (live) setUrls(read.filter((item) => item !== null));
    });
    return () => {
      live = false;
      for (const url of made) URL.revokeObjectURL(url);
    };
  }, [key]);
  return urls;
}
