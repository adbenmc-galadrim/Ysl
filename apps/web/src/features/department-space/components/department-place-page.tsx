import { PICKUP_DAYS } from '@repo/contract/settings';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { LieuLectureDesktop, LieuLectureMobile } from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '#/features/db/database';
import { useOwnDepartment } from '#/features/department-space/use-own-department';
import { readPickup } from '#/features/settings/pickup';
import { DESK_WIDTH, useMediaQuery } from '#/lib/use-media-query';

const t = createTranslator(DEFAULT_LOCALE);

/** Where and when the department hands over, as the e-mails say it: to read here (maquette 20). */
export function DepartmentPlacePage() {
  const navigate = useNavigate();
  const desk = useMediaQuery(DESK_WIDTH);
  const own = useOwnDepartment();
  const company = useLiveQuery(() => readPickup(db), []);
  const pickup = own.pickup ?? company;
  if (!pickup) return null;
  const orNone = (value: string) => value || t('departmentSpace.place.empty');
  const props = {
    title: t('departmentSpace.place.title'),
    subtitle: own.name,
    items: [
      {
        label: t('departmentSpace.place.place'),
        value: orNone(pickup.place || own.place),
      },
      ...PICKUP_DAYS.map((day) => ({
        label: t(`settings.pickup.day.${day}`),
        value: orNone(pickup.hours[day]),
      })),
      {
        label: t('departmentSpace.place.instructions'),
        value: orNone(pickup.instructions),
      },
    ],
    footer: t('departmentSpace.place.footer'),
  };
  return desk ? (
    <LieuLectureDesktop {...props} />
  ) : (
    <LieuLectureMobile
      {...props}
      onBack={() => void navigate({ to: '/reglages' })}
    />
  );
}
