import {
  PICKUP_DAYS,
  PICKUP_HOURS_MAX,
  PICKUP_INSTRUCTIONS_MAX,
  PICKUP_PLACE_MAX,
  type PickupSetting,
} from '@repo/contract/settings';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { LieuEtHorairesScreen } from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { useSession } from '#/features/auth/api/use-session';
import { db } from '#/features/db/database';
import { readPickup, savePickup } from '#/features/settings/pickup';

const t = createTranslator(DEFAULT_LOCALE);

/**
 * Réglages › Lieu et horaires (admin): what every e-mail tells the recipient
 * about collecting (F35, D13). Read from this iPhone's copy, so it opens
 * offline; leaving the screen, by OK or back, saves it.
 */
export function PickupScreen() {
  const navigate = useNavigate();
  const session = useSession();
  const stored = useLiveQuery(() => readPickup(db), []);
  const [draft, setDraft] = useState<PickupSetting | null>(null);
  const [failed, setFailed] = useState(false);
  const leaving = useRef(false);
  const value = draft ?? stored;
  if (!value) return null;

  const edit = (change: Partial<PickupSetting>) =>
    setDraft({ ...value, ...change });
  const leave = async () => {
    if (leaving.current) return;
    leaving.current = true;
    try {
      if (draft) await savePickup(db, draft, { userId: session.user.id });
    } catch {
      leaving.current = false;
      setFailed(true);
      return;
    }
    await navigate({ to: '/reglages' });
  };

  return (
    <LieuEtHorairesScreen
      place={value.place}
      onPlaceChange={(place) => edit({ place })}
      hours={PICKUP_DAYS.map((day) => ({
        day: t(`settings.pickup.day.${day}`),
        hours: value.hours[day],
      }))}
      onHoursChange={(index, hours) => {
        const day = PICKUP_DAYS[index];
        if (day) edit({ hours: { ...value.hours, [day]: hours } });
      }}
      instructions={value.instructions}
      onInstructionsChange={(instructions) => edit({ instructions })}
      footer={t('settings.pickup.footer')}
      error={failed ? t('settings.pickup.saveFailed') : undefined}
      placeMaxLength={PICKUP_PLACE_MAX}
      hoursMaxLength={PICKUP_HOURS_MAX}
      instructionsMaxLength={PICKUP_INSTRUCTIONS_MAX}
      onBack={() => void leave()}
      onDone={() => void leave()}
    />
  );
}
