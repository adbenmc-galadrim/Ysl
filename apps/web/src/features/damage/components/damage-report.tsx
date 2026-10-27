import { Navigate, useNavigate, useRouter } from '@tanstack/react-router';
import { Screen } from '@repo/ui';
import { useSession } from '#/features/auth/api/use-session';
import { DamageForm } from '#/features/damage/components/damage-form';
import { reportDamage } from '#/features/damage/report';
import { db } from '#/features/db/database';
import { photoFiles } from '#/features/photos/opfs';
import { useParcelRecord } from '#/features/parcels/api/parcel-record';
import { describeRecord } from '#/features/parcels/record';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';

const t = createTranslator(DEFAULT_LOCALE);

/** « Signaler un dommage » from a parcel's record: saved, back to the record. */
export function DamageReportView({ parcelId }: { parcelId: string }) {
  const navigate = useNavigate();
  const router = useRouter();
  const session = useSession();
  const record = useParcelRecord(parcelId);

  if (record === undefined) return <Screen>{null}</Screen>;
  if (record === null) {
    return <Navigate to="/colis/$parcelId" params={{ parcelId }} replace />;
  }

  const leave = () => {
    if (router.history.canGoBack()) router.history.back();
    else void navigate({ to: '/colis/$parcelId', params: { parcelId } });
  };
  const view = describeRecord(record, {
    now: new Date(),
    t,
    showUnsent: false,
  });
  const tracking = record.parcel.tracking;

  return (
    <DamageForm
      parcel={{
        recipient: view.recipient,
        carrier: view.carrier,
        last4: tracking ? tracking.slice(-4) : '',
      }}
      onClose={leave}
      onSave={async (input, photos) => {
        await reportDamage(db, photoFiles, parcelId, input, photos, {
          agentId: session.user.id,
        });
        leave();
      }}
    />
  );
}
