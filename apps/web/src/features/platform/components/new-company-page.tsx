import { COMPANY_NAME_MAX } from '@repo/contract/platform';
import {
  PROFILE_MODELS,
  PROFILE_OF_MODEL,
  stepsChangedFromModel,
  type OperatingParam,
  type OperatingProfile,
  type ProfileModel,
} from '@repo/contract/operating-profile';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  NouvelleEntrepriseFonctionnementDesktop,
  NouvelleEntrepriseFonctionnementMobile,
  NouvelleEntrepriseModeleDesktop,
  NouvelleEntrepriseModeleMobile,
  type WizardStepGroup,
} from '@repo/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { COMPANIES_KEY } from '#/features/platform/components/companies-page';
import { platformErrorMessage } from '#/features/platform/errors';
import { usePlatformChrome } from '#/features/platform/components/use-platform-chrome';
import {
  choiceOf,
  OPTIONS,
  SECTIONS,
  withChoice,
} from '#/features/settings/operating-steps';
import { DESK_WIDTH, useMediaQuery } from '#/lib/use-media-query';
import { trpcClient } from '#/lib/trpc';

const t = createTranslator(DEFAULT_LOCALE);

const ICON = {
  small_site: 'truck',
  multi_departments: 'building',
  strict_traceability: 'shield',
} as const;

/** What each card promises: to keep in step with `PROFILE_OF_MODEL`. */
const FEATURES = {
  small_site: [
    { text: t('platform.model.small_site.feature.handover'), on: true },
    { text: t('platform.model.small_site.feature.deposit'), on: false },
    { text: t('platform.model.small_site.feature.email'), on: true },
    { text: t('platform.model.small_site.feature.reminders'), on: true },
  ],
  multi_departments: [
    { text: t('platform.model.multi_departments.feature.deposit'), on: true },
    { text: t('platform.model.multi_departments.feature.email'), on: true },
    { text: t('platform.model.multi_departments.feature.proof'), on: true },
    { text: t('platform.model.multi_departments.feature.reminders'), on: true },
  ],
  strict_traceability: [
    { text: t('platform.model.strict_traceability.feature.deposit'), on: true },
    {
      text: t('platform.model.strict_traceability.feature.handover'),
      on: true,
    },
    { text: t('platform.model.strict_traceability.feature.photo'), on: true },
    { text: t('platform.model.strict_traceability.feature.proof'), on: true },
  ],
} as const;

/** Two steps until the invitation comes as the third. */
const TOTAL_STEPS = 2;

function stepGroups(
  profile: OperatingProfile,
  model: ProfileModel,
): WizardStepGroup[] {
  return SECTIONS.map((section) => ({
    title: t(`operating.section.${section.id}`),
    steps: section.params.map((param: OperatingParam) => ({
      id: param,
      title: t(`operating.param.${param}`),
      hint: t(`operating.help.${param}`),
      options: OPTIONS[param],
      value: choiceOf(profile, param),
      modified: profile[param] !== PROFILE_OF_MODEL[model][param],
    })),
  }));
}

function changedLine(count: number): string {
  if (count === 0) return t('platform.new.changed.none');
  return count === 1
    ? t('platform.new.changed.one')
    : t('platform.new.changed.many', { count });
}

/** A name, a model, then each step of it (D30): what is written is what this page shows. */
export function NewCompanyPage() {
  const desk = useMediaQuery(DESK_WIDTH);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const chrome = usePlatformChrome();
  const [name, setName] = useState('');
  const [model, setModel] = useState<ProfileModel>('multi_departments');
  const [profile, setProfile] = useState<OperatingProfile>(
    PROFILE_OF_MODEL.multi_departments,
  );
  const [adjusting, setAdjusting] = useState(false);
  const create = useMutation({
    mutationFn: () =>
      trpcClient.platform.createCompany.mutate({
        name,
        profileModel: model,
        profile,
      }),
    onSuccess: async ({ id }) => {
      await queryClient.invalidateQueries({ queryKey: COMPANIES_KEY });
      void navigate({ to: '/entreprises/$id', params: { id } });
    },
    // The name is what gets refused: back where it is typed, adjustments kept.
    onError: () => setAdjusting(false),
  });
  const trimmed = name.trim();
  if (adjusting) {
    const changed = stepsChangedFromModel(model, profile);
    const step = {
      totalSteps: TOTAL_STEPS,
      groups: stepGroups(profile, model),
      onChoose: (param: string, choice: string) =>
        setProfile(withChoice(profile, param as OperatingParam, choice)),
      onBack: () => setAdjusting(false),
      confirmLabel: t('platform.new.confirm'),
      confirmDisabled: create.isPending,
      onConfirm: () => create.mutate(),
    };
    const revert = () => setProfile(PROFILE_OF_MODEL[model]);
    return desk ? (
      <NouvelleEntrepriseFonctionnementDesktop
        {...step}
        chrome={chrome}
        summary={t('platform.new.summary.desk', {
          model: t(`platform.model.${model}`),
          changed: changedLine(changed),
        })}
        note={t('platform.new.note.adjust')}
        onRevert={revert}
        hideRevert={changed === 0}
      />
    ) : (
      <NouvelleEntrepriseFonctionnementMobile
        {...step}
        summary={t('platform.new.summary', {
          model: t(`platform.model.${model}`),
          changed: changedLine(changed),
        })}
        onRevert={changed > 0 ? revert : undefined}
      />
    );
  }
  const shared = {
    name,
    onName: (value: string) => setName(value.slice(0, COMPANY_NAME_MAX)),
    onSelectModel: (id: string) => {
      if (id === model) return;
      setModel(id as ProfileModel);
      setProfile(PROFILE_OF_MODEL[id as ProfileModel]);
    },
    totalSteps: TOTAL_STEPS,
    confirmLabel: t('platform.new.continue'),
    confirmDisabled: !trimmed,
    onConfirm: () => {
      create.reset();
      setAdjusting(true);
    },
    onCancel: () => void navigate({ to: '/' }),
    error: create.isError ? platformErrorMessage(create.error) : undefined,
  };
  if (desk) {
    return (
      <NouvelleEntrepriseModeleDesktop
        {...shared}
        chrome={chrome}
        note={t('platform.new.note')}
        models={PROFILE_MODELS.map((id) => ({
          id,
          name: t(`platform.model.${id}.title`),
          description: t(`platform.model.${id}.description`),
          selected: id === model,
          features: [...FEATURES[id]],
        }))}
      />
    );
  }
  return (
    <NouvelleEntrepriseModeleMobile
      {...shared}
      models={PROFILE_MODELS.map((id) => ({
        id,
        icon: ICON[id],
        name: t(`platform.model.${id}.title`),
        description: t(`platform.model.${id}.description`),
        selected: id === model,
      }))}
    />
  );
}
