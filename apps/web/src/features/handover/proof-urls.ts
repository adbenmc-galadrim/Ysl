import type { ProofMediaItem } from '@repo/ui';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '#/features/db/database';
import type { HandoverProofKind } from '#/features/db/schema';
import { readProof } from '#/features/handover/proofs';
import { photoFiles } from '#/features/photos/opfs';

export type ProofUrls = Partial<Record<HandoverProofKind, string>>;

/**
 * Object URLs of the signature and the photo of a handover, read from OPFS:
 * empty when this iPhone holds none (taken on another one, D8). They follow
 * the proofs as they are added, and are revoked when the screen closes.
 */
export function useProofUrls(handoverId: string): ProofUrls {
  const key = useLiveQuery(
    async () =>
      (await db.handoverProof.where('handoverId').equals(handoverId).toArray())
        .map((proof) => proof.id)
        .sort()
        .join(','),
    [handoverId],
  );
  const [urls, setUrls] = useState<ProofUrls>({});
  useEffect(() => {
    if (!key) {
      setUrls({});
      return;
    }
    const made: string[] = [];
    let live = true;
    void Promise.all(
      key.split(',').map(async (id) => {
        const proof = await db.handoverProof.get(id);
        if (!proof) return null;
        try {
          const blob = await readProof(photoFiles, proof);
          if (!live) return null;
          const url = URL.createObjectURL(blob);
          made.push(url);
          return [proof.kind, url] as const;
        } catch {
          return null;
        }
      }),
    ).then((read) => {
      if (live) setUrls(Object.fromEntries(read.filter((item) => !!item)));
    });
    return () => {
      live = false;
      for (const url of made) URL.revokeObjectURL(url);
    };
  }, [key]);
  return urls;
}

/**
 * The proofs kept here as the screens show them, the signature first; only
 * the photo opens full screen (black ink would vanish on the dark viewer).
 */
export function proofMediaItems(
  urls: ProofUrls,
  labels: Record<HandoverProofKind, string>,
  onOpen?: (url: string) => void,
): ProofMediaItem[] {
  return (['signature', 'photo'] as const).flatMap((kind) => {
    const src = urls[kind];
    return src
      ? [
          {
            kind,
            src,
            alt: labels[kind],
            ...(onOpen && kind === 'photo'
              ? { onOpen: () => onOpen(src) }
              : {}),
          },
        ]
      : [];
  });
}
