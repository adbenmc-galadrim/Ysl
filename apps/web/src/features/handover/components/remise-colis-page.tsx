import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { RemiseColisScreen } from '@repo/ui';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '#/features/db/database';
import type { PickupRefusal } from '#/features/handover/pickup-lookup';
import {
  type HandoverDone,
  HandoverRefusedError,
  recordHandover,
} from '#/features/handover/record-handover';
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
  agentId: string;
  onBack: () => void;
  /** The card or contact is no longer on this iPhone. */
  onGone: () => void;
  /** The QR or the code no longer opens: back to the viewfinder, saying why. */
  onRefused: (reason: PickupRefusal) => void;
  onDone: (done: HandoverDone) => void;
};

/**
 * P4 steps 2 and 4: the person is known, their parcels are listed, all
 * ticked; the agent unticks what stays on the shelf and hands the rest
 * over. The QR or the code is checked again as it is written.
 */
export function RemiseColisPage({
  search,
  agentId,
  onBack,
  onGone,
  onRefused,
  onDone,
}: RemiseColisPageProps) {
  const now = useMinuteClock();
  const { kind, id, via, at } = search;
  const [excluded, setExcluded] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
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
  const ticked = parcels
    .map((parcel) => parcel.id)
    .filter((parcelId) => !excluded.includes(parcelId));
  const time = formatTime(new Date(at));

  const toggle = (parcelId: string) =>
    setExcluded((current) =>
      current.includes(parcelId)
        ? current.filter((other) => other !== parcelId)
        : [...current, parcelId],
    );
  const toggleAll = () =>
    setExcluded(
      ticked.length === parcels.length ? parcels.map((p) => p.id) : [],
    );
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      onDone(
        await recordHandover(db, { ...search, parcelIds: ticked }, { agentId }),
      );
    } catch (error) {
      setBusy(false);
      if (!(error instanceof HandoverRefusedError)) throw error;
      switch (error.reason) {
        case 'gone':
          return onGone();
        case 'missing':
        case 'mismatch':
          return onRefused('unknown');
        case 'stale':
        case 'nothing':
          return;
        default:
          return onRefused(error.reason);
      }
    }
  };

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
      signatureNote={t('handover.signature.soon')}
      parcels={parcels.map((parcel) => toRemiseParcel(parcel, now, t))}
      excluded={excluded}
      empty={t('handover.empty', { name: person.firstName })}
      extras={false}
      busy={busy}
      onToggle={toggle}
      onToggleAll={toggleAll}
      onConfirm={() => void confirm()}
      onBack={onBack}
    />
  );
}
