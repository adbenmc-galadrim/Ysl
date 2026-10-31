import {
  DEPOSIT_CONFIRMATIONS,
  EMAIL_MOMENTS,
  STEP_STATES,
  type OperatingParam,
  type OperatingProfile,
} from '@repo/contract/operating-profile';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';

const t = createTranslator(DEFAULT_LOCALE);

const stepOptions = STEP_STATES.map((value) => ({
  value,
  label: t(`operating.state.${value}`),
}));

export const OPTIONS: {
  [Param in OperatingParam]: readonly {
    value: OperatingProfile[Param] extends boolean
      ? 'yes' | 'no'
      : OperatingProfile[Param];
    label: string;
  }[];
} = {
  shuttleActsAsDepartment: [
    { value: 'no', label: t('operating.no') },
    { value: 'yes', label: t('operating.yes') },
  ],
  batchReview: stepOptions,
  depositConfirmation: DEPOSIT_CONFIRMATIONS.map((value) => ({
    value,
    label: t(`operating.deposit.${value}`),
  })),
  handoverProof: stepOptions,
  handoverScan: stepOptions,
  signature: stepOptions,
  photo: stepOptions,
  emailMoment: EMAIL_MOMENTS.map((value) => ({
    value,
    label: t(`operating.email.${value}`),
  })),
  reminders: STEP_STATES.map((value) => ({
    value,
    label: t(`operating.reminders.${value}`),
  })),
};

export const SECTIONS = [
  { id: 'reception', params: ['batchReview'] },
  { id: 'deposit', params: ['shuttleActsAsDepartment', 'depositConfirmation'] },
  {
    id: 'handover',
    params: ['handoverProof', 'handoverScan', 'signature', 'photo'],
  },
  { id: 'mail', params: ['emailMoment', 'reminders'] },
] as const satisfies { id: string; params: OperatingParam[] }[];

type Choice = string;

export const choiceOf = (
  profile: OperatingProfile,
  param: OperatingParam,
): Choice => {
  const value = profile[param];
  if (typeof value !== 'boolean') return value;
  return value ? 'yes' : 'no';
};

export const withChoice = (
  profile: OperatingProfile,
  param: OperatingParam,
  choice: Choice,
): OperatingProfile => ({
  ...profile,
  [param]: param === 'shuttleActsAsDepartment' ? choice === 'yes' : choice,
});
