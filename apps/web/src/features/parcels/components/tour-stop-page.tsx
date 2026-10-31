import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { TourStopScreen } from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '#/features/db/database';
import { loadRecipientContext } from '#/features/parcels/api/use-parcels';
import { departmentName } from '#/features/parcels/components/tour-page';
import { loadTour } from '#/features/parcels/api/use-tour';
import { carrierLabel, recipientOf } from '#/features/parcels/model';

const t = createTranslator(DEFAULT_LOCALE);

/** What the shuttle carries for one department; YSL-134 deposits from here. */
export function TourStopPage({ departmentId }: { departmentId: string }) {
  const navigate = useNavigate();
  const stop = useLiveQuery(async () => {
    const { tour, departments } = await loadTour(db);
    const parcels =
      tour.stops.find((row) => row.departmentId === departmentId)?.parcels ??
      [];
    return {
      department: departments.get(departmentId),
      parcels,
      context: await loadRecipientContext(db, parcels),
    };
  }, [departmentId]);
  const count = stop?.parcels.length ?? 0;
  const parcelsLine =
    count === 1 ? t('tour.parcels.one') : t('tour.parcels.many', { count });
  const place = stop?.department?.receptionPoint;
  return (
    <TourStopScreen
      name={departmentName(stop?.department)}
      subtitle={place ? `${place} · ${parcelsLine}` : parcelsLine}
      parcels={(stop?.parcels ?? []).map((parcel) => {
        const { person, contact } = recipientOf(parcel, stop!.context);
        const carrier = carrierLabel(parcel, t);
        const last4 =
          parcel.tracking && parcel.type !== 'sans_suivi'
            ? parcel.tracking.slice(-4)
            : '';
        return {
          id: parcel.id,
          title: person
            ? `${person.firstName} ${person.lastName}`
            : (contact?.name ?? t('parcel.recipient.unknown')),
          line: last4 ? `${carrier} ···${last4}` : carrier,
        };
      })}
      onBack={() => void navigate({ to: '/' })}
      onParcel={(parcelId) =>
        void navigate({ to: '/colis/$parcelId', params: { parcelId } })
      }
    />
  );
}
