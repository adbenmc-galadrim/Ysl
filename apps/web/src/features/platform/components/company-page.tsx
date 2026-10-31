import type { PlatformCompanyDetail } from '@repo/contract/platform';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  Button,
  DeleteDialog,
  EntreprisesErreurDesktop,
  FicheEntrepriseDesktop,
  FicheEntrepriseMountedMobile,
  RenameDialog,
  SupprimerMobile,
  SuspendDialog,
  SuspendreMobile,
} from '@repo/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { COMPANIES_KEY } from '#/features/platform/components/companies-page';
import {
  counted,
  figure,
  longDate,
  modelName,
} from '#/features/platform/company-view';
import { platformErrorMessage } from '#/features/platform/errors';
import { usePlatformChrome } from '#/features/platform/components/use-platform-chrome';
import { initialsOf } from '#/features/settings/initials';
import { DESK_WIDTH, useMediaQuery } from '#/lib/use-media-query';
import { trpcClient } from '#/lib/trpc';

const t = createTranslator(DEFAULT_LOCALE);

type Asked = 'suspend' | 'delete' | 'rename' | null;

function statusLine(company: PlatformCompanyDetail): string {
  const shared = {
    date: longDate(company.createdAt),
    model: modelName(company.profileModel, t),
  };
  return company.suspendedAt
    ? t('platform.sheet.status.suspended', {
        ...shared,
        since: longDate(company.suspendedAt),
      })
    : t('platform.sheet.status.active', shared);
}

function useCompanyActions(id: string, onDone: () => void) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const refreshed = async () => {
    await queryClient.invalidateQueries({ queryKey: ['platform'] });
    onDone();
  };
  return {
    suspend: useMutation({
      mutationFn: () => trpcClient.platform.suspendCompany.mutate({ id }),
      onSuccess: refreshed,
    }),
    reactivate: useMutation({
      mutationFn: () => trpcClient.platform.reactivateCompany.mutate({ id }),
      onSuccess: refreshed,
    }),
    rename: useMutation({
      mutationFn: (name: string) =>
        trpcClient.platform.renameCompany.mutate({ id, name }),
      onSuccess: refreshed,
    }),
    remove: useMutation({
      mutationFn: (confirmName: string) =>
        trpcClient.platform.deleteCompany.mutate({ id, confirmName }),
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: COMPANIES_KEY });
        queryClient.removeQueries({ queryKey: ['platform', 'company', id] });
        void navigate({ to: '/' });
      },
    }),
  };
}

/** One client: its name and figures, what can be done to it. No account is named (D26). */
export function CompanyPage({ id }: { id: string }) {
  const desk = useMediaQuery(DESK_WIDTH);
  const navigate = useNavigate();
  const chrome = usePlatformChrome();
  const [asked, setAsked] = useState<Asked>(null);
  const [typed, setTyped] = useState('');
  const [newName, setNewName] = useState('');
  const actions = useCompanyActions(id, () => setAsked(null));
  const query = useQuery({
    queryKey: ['platform', 'company', id],
    queryFn: () => trpcClient.platform.company.query({ id }),
  });
  const company = query.data;

  if (!company) {
    if (query.isPending) return null;
    return desk ? (
      <EntreprisesErreurDesktop
        chrome={chrome}
        onRetry={() => void query.refetch()}
      />
    ) : (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p role="alert">{platformErrorMessage(query.error)}</p>
        <Button variant="secondary" onClick={() => void navigate({ to: '/' })}>
          {t('platform.nav.companies')}
        </Button>
      </div>
    );
  }

  const close = () => {
    setAsked(null);
    setTyped('');
    actions.suspend.reset();
    actions.rename.reset();
    actions.remove.reset();
  };
  const askRename = () => {
    setNewName(company.name);
    setAsked('rename');
  };
  const accounts = counted('accounts', company.accounts, t);
  const suspendText = t('platform.suspend.description', { accounts });
  const deleteText = t('platform.delete.description', {
    accounts,
    departments: counted('departments', company.departments, t),
    parcels: t('platform.count.parcels', { count: figure(company.parcels) }),
  });
  const errorOf = (mutation: { isError: boolean; error: unknown }) =>
    mutation.isError ? platformErrorMessage(mutation.error) : undefined;
  const suspended = company.suspendedAt !== null;
  const stats = [
    {
      label: t('platform.sheet.stat.accounts'),
      value: figure(company.accounts),
    },
    {
      label: t('platform.sheet.stat.departments'),
      value: figure(company.departments),
    },
    { label: t('platform.sheet.stat.parcels'), value: figure(company.parcels) },
  ];
  const model = modelName(company.profileModel, t);
  const changedSteps =
    company.changedSteps === null ? null : figure(company.changedSteps);
  const primary = () =>
    suspended ? actions.reactivate.mutate() : setAsked('suspend');
  const primaryLabel = suspended
    ? t('platform.sheet.reactivate')
    : t('platform.sheet.suspend');

  if (desk) {
    const renameDialog = asked === 'rename' && (
      <RenameDialog
        name={newName}
        onName={setNewName}
        disabled={!newName.trim() || actions.rename.isPending}
        error={errorOf(actions.rename)}
        onCancel={close}
        onConfirm={() => actions.rename.mutate(newName)}
      />
    );
    const suspendDialog = asked === 'suspend' && (
      <SuspendDialog
        name={company.name}
        description={suspendText}
        pending={actions.suspend.isPending}
        error={errorOf(actions.suspend)}
        onCancel={close}
        onConfirm={() => actions.suspend.mutate()}
      />
    );
    const deleteDialog = asked === 'delete' && (
      <DeleteDialog
        name={company.name}
        description={deleteText}
        typed={typed}
        onTyped={setTyped}
        exportHint={t('platform.delete.exportHint')}
        pending={actions.remove.isPending}
        error={errorOf(actions.remove)}
        onCancel={close}
        onConfirm={() => actions.remove.mutate(typed)}
      />
    );
    return (
      <FicheEntrepriseDesktop
        chrome={chrome}
        overlay={renameDialog || suspendDialog || deleteDialog || undefined}
        data={{
          name: company.name,
          initials: initialsOf(company.name),
          status: actions.reactivate.isError
            ? platformErrorMessage(actions.reactivate.error)
            : statusLine(company),
          suspended,
          stats,
          profile: [
            [t('platform.sheet.model'), model],
            ...(changedSteps === null
              ? []
              : [[t('platform.sheet.changedSteps'), changedSteps]]),
          ],
          actions: (
            <>
              <Button
                variant="outline"
                size="desk"
                icon={suspended ? 'refresh' : 'pause'}
                disabled={actions.reactivate.isPending}
                onClick={primary}
              >
                {primaryLabel}
              </Button>
              <Button variant="outline" size="desk" onClick={askRename}>
                {t('platform.sheet.rename')}
              </Button>
              <Button
                variant="outline"
                size="desk"
                className="text-red"
                onClick={() => setAsked('delete')}
              >
                {t('platform.sheet.delete')}
              </Button>
            </>
          ),
        }}
      />
    );
  }
  return (
    <>
      <FicheEntrepriseMountedMobile
        name={company.name}
        initials={initialsOf(company.name)}
        suspended={suspended}
        statusLabel={
          suspended
            ? t('platform.status.suspended')
            : t('platform.status.active')
        }
        notice={
          company.suspendedAt
            ? {
                title: t('platform.sheet.notice.title', {
                  since: longDate(company.suspendedAt),
                }),
                description: t('platform.sheet.notice.description'),
              }
            : undefined
        }
        stats={stats}
        error={errorOf(actions.reactivate)}
        profile={[
          { title: t('platform.sheet.model'), value: model },
          ...(changedSteps === null
            ? []
            : [
                {
                  title: t('platform.sheet.changedSteps'),
                  value: changedSteps,
                },
              ]),
        ]}
        onBack={() => void navigate({ to: '/' })}
        primaryLabel={primaryLabel}
        onPrimary={primary}
      >
        <div className="mt-6 flex flex-col gap-3">
          <Button block variant="secondary" onClick={askRename}>
            {t('platform.sheet.rename')}
          </Button>
          <Button block variant="danger" onClick={() => setAsked('delete')}>
            {t('platform.sheet.delete')}
          </Button>
        </div>
      </FicheEntrepriseMountedMobile>
      {asked === 'suspend' && (
        <SuspendreMobile
          fixed
          name={company.name}
          description={suspendText}
          pending={actions.suspend.isPending}
          error={errorOf(actions.suspend)}
          onCancel={close}
          onConfirm={() => actions.suspend.mutate()}
        />
      )}
      {asked === 'delete' && (
        <SupprimerMobile
          fixed
          name={company.name}
          description={deleteText}
          typed={typed}
          onTyped={setTyped}
          pending={actions.remove.isPending}
          error={errorOf(actions.remove)}
          onCancel={close}
          onConfirm={() => actions.remove.mutate(typed)}
        />
      )}
      {asked === 'rename' && (
        <div className="fixed inset-0 z-50">
          <RenameDialog
            name={newName}
            onName={setNewName}
            disabled={!newName.trim() || actions.rename.isPending}
            error={errorOf(actions.rename)}
            onCancel={close}
            onConfirm={() => actions.rename.mutate(newName)}
          />
        </div>
      )}
    </>
  );
}
