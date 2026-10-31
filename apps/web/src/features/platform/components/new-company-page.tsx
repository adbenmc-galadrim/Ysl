import { COMPANY_NAME_MAX } from '@repo/contract/platform';
import {
  PROFILE_MODELS,
  type ProfileModel,
} from '@repo/contract/operating-profile';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  NouvelleEntrepriseModeleDesktop,
  NouvelleEntrepriseModeleMobile,
} from '@repo/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { COMPANIES_KEY } from '#/features/platform/components/companies-page';
import { platformErrorMessage } from '#/features/platform/errors';
import { usePlatformChrome } from '#/features/platform/components/use-platform-chrome';
import { DESK_WIDTH, useMediaQuery } from '#/lib/use-media-query';
import { trpcClient } from '#/lib/trpc';

const t = createTranslator(DEFAULT_LOCALE);

const ICON = {
  small_site: 'truck',
  multi_departments: 'building',
  strict_traceability: 'shield',
} as const;

/** What each card promises: the test of the model's profile holds it to its word. */
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
    { text: t('platform.model.strict_traceability.feature.handover'), on: true },
    { text: t('platform.model.strict_traceability.feature.photo'), on: true },
    { text: t('platform.model.strict_traceability.feature.proof'), on: true },
  ],
} as const;

/** A name and a model (D30): the steps after it come with YSL-125 and YSL-122. */
export function NewCompanyPage() {
  const desk = useMediaQuery(DESK_WIDTH);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const chrome = usePlatformChrome();
  const [name, setName] = useState('');
  const [model, setModel] = useState<ProfileModel>('small_site');
  const create = useMutation({
    mutationFn: () =>
      trpcClient.platform.createCompany.mutate({
        name,
        profileModel: model,
      }),
    onSuccess: async ({ id }) => {
      await queryClient.invalidateQueries({ queryKey: COMPANIES_KEY });
      void navigate({ to: '/entreprises/$id', params: { id } });
    },
  });
  const trimmed = name.trim();
  const shared = {
    name,
    onName: (value: string) => setName(value.slice(0, COMPANY_NAME_MAX)),
    onSelectModel: (id: string) => setModel(id as ProfileModel),
    confirmLabel: t('platform.new.confirm'),
    confirmDisabled: !trimmed || create.isPending,
    onConfirm: () => create.mutate(),
    onCancel: () => void navigate({ to: '/' }),
    error: create.isError ? platformErrorMessage(create.error) : undefined,
  };
  if (desk) {
    return (
      <NouvelleEntrepriseModeleDesktop
        {...shared}
        chrome={chrome}
        steps={false}
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
      withStep={false}
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
