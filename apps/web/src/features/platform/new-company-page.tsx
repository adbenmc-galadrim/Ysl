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
import { COMPANIES_KEY } from '#/features/platform/companies-page';
import { platformErrorMessage } from '#/features/platform/errors';
import { usePlatformChrome } from '#/features/platform/use-platform-chrome';
import { DESK_WIDTH, useMediaQuery } from '#/lib/use-media-query';
import { trpcClient } from '#/lib/trpc';

const t = createTranslator(DEFAULT_LOCALE);

const ICON = { small_site: 'truck', multi_departments: 'building' } as const;

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
          features: [
            { text: t(`platform.model.${id}.feature.handover`), on: true },
            { text: t('platform.model.feature.deposit'), on: false },
            { text: t('platform.model.feature.email'), on: true },
            { text: t('platform.model.feature.reminders'), on: true },
          ],
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
