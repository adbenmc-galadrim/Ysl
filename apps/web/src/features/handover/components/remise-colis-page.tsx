import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { RemiseColisScreen } from '@repo/ui';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { db } from '#/features/db/database';
import { loadHandoverPerson } from '#/features/handover/recipient';
import type { RemiseColisSearch } from '#/features/handover/route';
import {
  listWaitingParcels,
  toRemiseParcel,
} from '#/features/handover/waiting';
import { useMinuteClock } from '#/features/parcels/api/use-parcels';
import { formatTime } from '#/features/parcels/model';

const t = createTranslator(DEFAULT_LOCALE);

export type RemiseColisPageProps = {
  search: RemiseColisSearch;
  onBack: () => void;
  /** The card or contact is no longer on this iPhone. */
  onGone: () => void;
};

/**
 * P4 step 2: the person is known, their parcels are listed, all ticked.
 * Read only for now: recording the handover comes with YSL-74 and YSL-76.
 */
export function RemiseColisPage({
  search,
  onBack,
  onGone,
}: RemiseColisPageProps) {
  const now = useMinuteClock();
  const { kind, id, via, at } = search;
  const loaded = useLiveQuery(async () => {
    const [person, parcels] = await Promise.all([
      loadHandoverPerson(db, { kind, id }),
      listWaitingParcels(db, { kind, id }),
    ]);
    return { person, parcels };
  }, [kind, id]);

  const gone = loaded !== undefined && loaded.person === null;
  useEffect(() => {
    if (gone) onGone();
  }, [gone, onGone]);

  if (!loaded?.person) return null;
  const { person, parcels } = loaded;
  const time = formatTime(new Date(at));
  return (
    <RemiseColisScreen
      recipient={person}
      verified={
        via === 'qr'
          ? t('handover.verified.qr', { time })
          : via === 'pin'
            ? t('handover.verified.pin', { time })
            : t('handover.verified.manuel')
      }
      verifiedBy={via === 'manuel' ? 'name' : 'proof'}
      parcels={parcels.map((parcel) => toRemiseParcel(parcel, now, t))}
      empty={t('handover.empty', { name: person.firstName })}
      confirmNote={t('handover.soon')}
      extras={false}
      onBack={onBack}
    />
  );
}
