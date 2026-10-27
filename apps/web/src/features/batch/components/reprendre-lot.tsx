import { LabelThumb, ReprendreLotScreen, RESUME_THUMBNAILS } from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import {
  BOOT_AT,
  formatBatchStart,
  offersResume,
} from '#/features/batch/resume';
import { discardBatch, listDrafts } from '#/features/batch/store';
import { useBatch } from '#/features/batch/use-batch';
import { useDraftPhotos } from '#/features/batch/use-draft-photos';
import { db } from '#/features/db/database';
import { photoFiles } from '#/features/photos/opfs';

/** The batch the agent already answered for, until the app is relaunched. */
let answeredId: string | undefined;

/**
 * Mounted on the home: a batch cut short by a crash or a swipe away is
 * offered back before any new scan would silently pick it up.
 */
export function ReprendreLot() {
  const navigate = useNavigate();
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
  const urls = useDraftPhotos(drafts, RESUME_THUMBNAILS);
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
      onReview={answer(() => void navigate({ to: '/revue' }))}
      onDiscard={answer(() => discardBatch(db, photoFiles, batch.id))}
    />
  );
}
