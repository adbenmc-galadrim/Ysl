import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { TourStopScreen } from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '#/features/db/database';
import { loadRecipientContext } from '#/features/parcels/api/use-parcels';
import { loadTour } from '#/features/parcels/api/use-tour';
import { carrierLineOf, describeParcel } from '#/features/parcels/model';
import { departmentName, parcelsLabel } from '#/features/parcels/tour-view';

const t = createTranslator(DEFAULT_LOCALE);

/** What the shuttle carries for one department; YSL-134 deposits from here. */
export function TourStopPage({ departmentId }: { departmentId: string }) {
  const navigate = useNavigate();
  const stop = useLiveQuery(async () => {
    const { tour, departments } = await loadTour(db);
    const parcels =
      tour.stops.find((row) => row.departmentId === departmentId)?.parcels ??
      [];
    const context = await loadRecipientContext(db, parcels);
    const now = new Date();
    return {
      department: departments.get(departmentId),
      rows: parcels.map((parcel) => ({
        id: parcel.id,
        title: describeParcel(parcel, 'onTour', context, now, t).recipient,
        line: carrierLineOf(parcel, t),
      })),
    };
  }, [departmentId]);
  const count = parcelsLabel(stop?.rows.length ?? 0, t);
  const place = stop?.department?.receptionPoint;
  return (
    <TourStopScreen
      name={departmentName(stop?.department, t)}
      subtitle={
        place ? t('tour.stop.subtitle', { place, parcels: count }) : count
      }
      parcels={stop?.rows ?? []}
      onBack={() => void navigate({ to: '/' })}
      onParcel={(parcelId) =>
        void navigate({ to: '/colis/$parcelId', params: { parcelId } })
      }
    />
  );
}
