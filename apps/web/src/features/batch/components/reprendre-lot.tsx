import { LabelThumb, ReprendreLotScreen, RESUME_THUMBNAILS } from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { useSession } from '#/features/auth/api/use-session';
import {
  BOOT_AT,
  formatBatchStart,
  offersResume,
} from '#/features/batch/resume';
import { discardBatch, finishBatch, listDrafts } from '#/features/batch/store';
import { useBatch } from '#/features/batch/use-batch';
import { db } from '#/features/db/database';
import type { DraftParcel } from '#/features/db/schema';
import { photoFiles } from '#/features/photos/opfs';
import { readPhoto } from '#/features/photos/store';

/** The batch the agent already answered for, until the app is relaunched. */
let answeredId: string | undefined;

/** Object URLs of the first drafts' photos, revoked when they leave. */
function useDraftPhotos(drafts: DraftParcel[]): Map<string, string> {
  const [urls, setUrls] = useState(() => new Map<string, string>());
  const wanted = drafts
    .slice(0, RESUME_THUMBNAILS)
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

/**
 * Mounted on the home: a batch cut short by a crash or a swipe away is
 * offered back before any new scan would silently pick it up.
 */
export function ReprendreLot() {
  const navigate = useNavigate();
  const session = useSession();
  const view = useBatch();
  const [, answered] = useState<string>();
  const busy = useRef(false);
  const batch = view?.batch;
  const offered = offersResume(batch, view?.last, BOOT_AT, answeredId);
  const drafts =
    useLiveQuery(
      () => (offered ? listDrafts(db, batch.id) : Promise.resolve([])),
      [offered ? batch.id : undefined],
    ) ?? [];
  const urls = useDraftPhotos(drafts);
  if (!offered || drafts.length === 0) return null;

  const answer = (then: () => Promise<unknown> | void) => () => {
    if (busy.current) return;
    busy.current = true;
    answeredId = batch.id;
    void Promise.resolve(then())
      .catch((error: unknown) => {
        answeredId = undefined;
        reportError(error);
      })
      .finally(() => {
        busy.current = false;
        answered(batch.id);
      });
  };

  return (
    <ReprendreLotScreen
      fixed
      startedAt={formatBatchStart(batch.startedAt, new Date())}
      parcels={drafts}
      thumbnail={(draft, i) => {
        const url = draft.photoId ? urls.get(draft.photoId) : undefined;
        return url ? (
          <img
            src={url}
            alt=""
            className="aspect-[52/64] h-auto w-full rounded-[8px] bg-fill object-cover"
          />
        ) : (
          <LabelThumb
            width={52}
            height={64}
            radius={8}
            tone={i % 2 ? 'light' : 'mid'}
            className="h-auto w-full"
          />
        );
      }}
      onResume={answer(() => void navigate({ to: '/scan' }))}
      onReview={answer(() =>
        finishBatch(db, { batchId: batch.id, agentId: session.user.id }),
      )}
      onDiscard={answer(() => discardBatch(db, photoFiles, batch.id))}
    />
  );
}
