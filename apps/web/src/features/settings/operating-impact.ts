import type {
  OperatingChange,
  StepState,
} from '@repo/contract/operating-profile';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';

const t = createTranslator(DEFAULT_LOCALE);

const count = (
  parcels: number,
  stage: 'ready' | 'review' | 'notified' | 'signature' | 'onTour',
) =>
  parcels === 1
    ? t(`operating.impact.${stage}.one`)
    : t(`operating.impact.${stage}.many`, { count: parcels });

const effect = (state: StepState) => t(`operating.effect.${state}`);

/** One line of the announcement (ME17): which parcels, and what changes for them. */
export function impactLine(change: OperatingChange): string {
  if (change.parcels === 0) return t('operating.impact.none');
  const { parcels } = change;
  switch (change.param) {
    case 'signature':
      if (change.to === 'required') return count(parcels, 'signature');
      return `${count(parcels, 'ready')} : ${effect(change.to)}`;
    case 'handoverProof':
    case 'handoverScan':
    case 'photo':
      return `${count(parcels, 'ready')} : ${effect(change.to)}`;
    case 'batchReview':
      return `${count(parcels, 'review')} : ${effect(change.to)}`;
    case 'reminders':
      return `${count(parcels, 'notified')} : ${t(`operating.effect.reminders.${change.to}`)}`;
    case 'shuttleActsAsDepartment':
      return `${count(parcels, 'ready')} : ${t(change.to ? 'operating.effect.shuttle.on' : 'operating.effect.shuttle.off')}`;
    case 'emailMoment':
      return `${count(parcels, 'onTour')} : ${t(`operating.effect.email.${change.to}`)}`;
    default:
      return t('operating.impact.none');
  }
}
