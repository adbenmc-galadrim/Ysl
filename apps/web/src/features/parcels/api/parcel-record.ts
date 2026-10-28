import {
  PARCEL_EVENT_ENTITY,
  readParcelEvent,
} from '@repo/contract/parcel-event';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '#/features/db/database';
import type { CourrierDatabase, LocalPhoto } from '#/features/db/schema';
import { photoFiles } from '#/features/photos/opfs';
import { readPhoto } from '#/features/photos/store';
import {
  cancelledHandoverOf,
  handoversOf,
  lostHandoverIds,
} from '#/features/handover/delivered';
import { proofKindsOf } from '#/features/handover/entry';
import type { ParcelRecord } from '#/features/parcels/record';

/**
 * A live parcel with its recipient, its history and what of it still waits
 * in the outbox; nothing when it was deleted or never reached this iPhone.
 */
export async function loadParcelRecord(
  database: CourrierDatabase,
  parcelId: string,
): Promise<ParcelRecord | null> {
  const parcel = await database.parcel.get(parcelId);
  if (!parcel || parcel.deletedAt) return null;
  const [person, contact, events] = await Promise.all([
    parcel.personId ? database.directoryPerson.get(parcel.personId) : undefined,
    parcel.contactId ? database.contact.get(parcel.contactId) : undefined,
    database.event
      .where('[entity+entityId]')
      .equals([PARCEL_EVENT_ENTITY, parcelId])
      .toArray(),
  ]);
  const [handovers, lostHandovers] = await Promise.all([
    handoversOf(database, [parcel]),
    lostHandoverIds(database, parcel),
  ]);
  const handover = handovers.get(parcelId);
  const cancelledHandover = handover
    ? undefined
    : await cancelledHandoverOf(database, parcel);
  const shown = handover ?? cancelledHandover;
  const mailIds = events.flatMap((row) => {
    const event = readParcelEvent(row.type, row.detail);
    return event?.type === 'parcel.notified' ? [event.notificationId] : [];
  });
  const [ops, handoverProofs, mails] = await Promise.all([
    database.outbox
      .where('[entity+entityId]')
      .anyOf([
        ['parcel', parcelId],
        ...events.map((event) => ['event', event.id]),
        ...(shown ? [['handover', shown.id]] : []),
      ])
      .toArray(),
    shown ? proofKindsOf(database, shown.id) : [],
    mailIds.length ? database.notification.bulkGet(mailIds) : [],
  ]);
  const relays = new Map(
    mails.flatMap((mail) =>
      mail?.relayName ? [[mail.id, mail.relayName] as const] : [],
    ),
  );
  return {
    parcel,
    person,
    contact,
    events,
    ops,
    handover,
    cancelledHandover,
    lostHandovers,
    handoverProofs,
    relays,
  };
}

/** `undefined` while it is read, `null` once known to be missing. */
export function useParcelRecord(
  parcelId: string,
): ParcelRecord | null | undefined {
  return useLiveQuery(() => loadParcelRecord(db, parcelId), [parcelId]);
}

/** The label photo taken on this iPhone, the oldest one when a parcel has several boxes. */
export async function findLabelPhoto(
  database: CourrierDatabase,
  parcelId: string,
): Promise<LocalPhoto | undefined> {
  const photos = await database.photo
    .where('parcelId')
    .equals(parcelId)
    .filter((photo) => photo.kind === 'etiquette')
    .sortBy('createdAt');
  return photos[0];
}

export type PhotoUrl =
  { state: 'loading' } | { state: 'absent' } | { state: 'ready'; url: string };

/**
 * An object URL of the label photo, read from OPFS: the photo never left
 * the iPhone that scanned (D8), so another iPhone has none to show. The URL
 * is revoked when the record closes.
 */
export function useLabelPhotoUrl(parcelId: string): PhotoUrl {
  const photoId = useLiveQuery(
    async () => (await findLabelPhoto(db, parcelId))?.id ?? null,
    [parcelId],
  );
  return usePhotoUrl(photoId);
}

/** An object URL of a photo of this iPhone; `undefined` while its id is read. */
export function usePhotoUrl(photoId: string | null | undefined): PhotoUrl {
  const [url, setUrl] = useState<PhotoUrl>({ state: 'loading' });
  useEffect(() => {
    if (photoId === undefined) return;
    if (photoId === null) {
      setUrl({ state: 'absent' });
      return;
    }
    setUrl({ state: 'loading' });
    let current: string | null = null;
    let live = true;
    db.photo
      .get(photoId)
      .then((photo) => {
        if (!photo) throw new Error(`No photo ${photoId}`);
        return readPhoto(photoFiles, photo);
      })
      .then((blob) => {
        if (!live) return;
        current = URL.createObjectURL(blob);
        setUrl({ state: 'ready', url: current });
      })
      .catch(() => {
        if (live) setUrl({ state: 'absent' });
      });
    return () => {
      live = false;
      if (current) URL.revokeObjectURL(current);
    };
  }, [photoId]);
  return url;
}
