import { LOCATION_MAX } from '@repo/contract/deposits';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { DepositLocationScreen } from '@repo/ui';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '#/features/db/database';
import { locationsOf } from '#/features/parcels/deposit';
import { parcelsLabel } from '#/features/parcels/tour-view';

const t = createTranslator(DEFAULT_LOCALE);

/** « Où rangez-vous ce lot ? », for the shuttle and for the department alike. */
export function DepositLocationStep({
  departmentId,
  count,
  current,
  onDone,
  onBack,
}: {
  departmentId: string;
  count: number;
  current: string | null;
  onDone: (location: string) => void;
  onBack: () => void;
}) {
  const known = useLiveQuery(
    () => locationsOf(db, departmentId),
    [departmentId],
  );
  const [picked, setPicked] = useState(current);
  const [typed, setTyped] = useState<string | null>(null);
  if (!known) return null;
  const locations =
    current && !known.includes(current) ? [current, ...known] : known;
  const adding = typed !== null || locations.length === 0;
  const chosen = adding ? (typed ?? '').trim() : picked;
  const parcels = parcelsLabel(count, t);
  return (
    <DepositLocationScreen
      navTitle={t('deposits.location.nav', { parcels })}
      title={t('deposits.location.title')}
      subtitle={t('deposits.location.subtitle')}
      locations={locations.map((title) => ({ title }))}
      selected={adding ? undefined : (picked ?? undefined)}
      onSelect={(location) => {
        setTyped(null);
        setPicked(location);
      }}
      addLabel={t('deposits.location.add')}
      onAdd={() => setTyped('')}
      adding={
        adding
          ? {
              label: t('deposits.location.new'),
              value: typed ?? '',
              maxLength: LOCATION_MAX,
              onChange: setTyped,
            }
          : undefined
      }
      actionLabel={t('deposits.location.action', { parcels })}
      actionDisabled={!chosen}
      onAction={() => chosen && onDone(chosen)}
      onBack={onBack}
    />
  );
}
