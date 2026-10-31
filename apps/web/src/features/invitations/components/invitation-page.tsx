import {
  inspectInvitationInput,
  type InvitationView,
} from '@repo/contract/accounts';
import { env } from '@repo/shared/env/web';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  Button,
  CreerMotDePasseDesktop,
  CreerMotDePasseMobile,
  DeskAuthPage,
  LienExpireMobile,
} from '@repo/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import {
  refusalMessage,
  usePasswordForm,
} from '#/features/invitations/password-form';
import {
  currentDisplayContext,
  isIosBrowserTab,
} from '#/features/install/browser-tab';
import { initialsOf } from '#/features/settings/initials';
import { trpcClient } from '#/lib/trpc';
import { DESK_WIDTH, useMediaQuery } from '#/lib/use-media-query';

const t = createTranslator(DEFAULT_LOCALE);

const longDate = (date: Date) =>
  date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

function Message({
  title,
  text,
  action,
  done = false,
}: {
  title: string;
  text: string;
  action?: ReactNode;
  done?: boolean;
}) {
  const desk = useMediaQuery(DESK_WIDTH);
  return desk ? (
    <DeskAuthPage
      fluid
      logo={initialsOf(env.PUBLIC_APP_NAME)}
      brand={env.PUBLIC_APP_NAME}
      footer={t('invitations.page.neutralFooter')}
    >
      <h1 className="text-26 font-bold tracking-[-0.3px]">{title}</h1>
      <p className="mt-2 text-14 text-muted">{text}</p>
      {action && <div className="mt-6">{action}</div>}
    </DeskAuthPage>
  ) : (
    <LienExpireMobile
      title={title}
      text={text}
      done={done}
      action={action ?? <></>}
    />
  );
}

function ToSignIn({ label }: { label: string }) {
  const navigate = useNavigate();
  return (
    <Button
      size="md"
      className="mt-[25px] h-12 w-[250px] rounded-[24px]"
      onClick={() => void navigate({ to: '/connexion', search: {} })}
    >
      {label}
    </Button>
  );
}

function Chosen({
  view,
  token,
  onDone,
  onRefused,
}: {
  view: Extract<InvitationView, { state: 'valid' }>;
  token: string;
  onDone: () => void;
  onRefused: () => void;
}) {
  const desk = useMediaQuery(DESK_WIDTH);
  const accept = useMutation({
    mutationFn: (password: string) =>
      trpcClient.invitations.accept.mutate({ token, password }),
    onSuccess: onDone,
    onError: onRefused,
  });
  const invite = view.kind === 'invite';
  const { fields, submit } = usePasswordForm({
    submitLabel: invite
      ? t('invitations.page.submit')
      : t('invitations.page.submitReset'),
    error: refusalMessage(accept.error),
    pending: accept.isPending,
    onSubmit: (password) => accept.mutate(password),
  });
  const role = view.role ? t(`auth.role.${view.role}`) : '';
  const logo = initialsOf(view.companyName);
  if (desk) {
    return (
      <CreerMotDePasseDesktop
        fluid
        logo={logo}
        brand={view.companyName}
        product={t('invitations.page.with', { app: env.PUBLIC_APP_NAME })}
        footer={t('invitations.page.footer', { company: view.companyName })}
        title={
          invite ? t('invitations.page.title') : t('invitations.page.titleReset')
        }
        subtitle={[view.name, view.departmentName ?? role].join(' · ')}
        form={
          <>
            {fields}
            <div className="mt-6">{submit}</div>
            <p className="mt-4 text-12 text-muted">
              {t('invitations.page.expires', {
                date: longDate(view.expiresAt),
              })}
            </p>
          </>
        }
      />
    );
  }
  return (
    <CreerMotDePasseMobile
      logo={logo}
      title={t('invitations.page.welcome', {
        name: view.name.split(' ')[0] ?? view.name,
      })}
      subtitle={t('invitations.page.subtitle', {
        role,
        company: view.companyName,
        email: view.email,
      })}
      form={fields}
      submit={submit}
    />
  );
}

/**
 * Where an invitation lands, signed in or not: it reads no session, so opening
 * a link on a phone already in use cannot empty it. In Safari on an iPhone the
 * password is chosen here, and the app is installed afterwards.
 */
export function InvitationPage() {
  const [token] = useState(() => window.location.hash.slice(1));
  const [done, setDone] = useState(false);
  const wellFormed = inspectInvitationInput.safeParse({ token }).success;
  const inspection = useQuery({
    queryKey: ['invitation'],
    queryFn: () => trpcClient.invitations.inspect.mutate({ token }),
    enabled: wellFormed && !done,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
  });

  if (done) {
    const inTab = isIosBrowserTab(currentDisplayContext());
    return (
      <Message
        done
        title={t('invitations.page.doneTitle')}
        text={
          inTab
            ? t('invitations.page.doneInstall')
            : t('invitations.page.doneSignIn')
        }
        action={
          <ToSignIn
            label={
              inTab
                ? t('invitations.page.install')
                : t('invitations.page.signIn')
            }
          />
        }
      />
    );
  }
  if (wellFormed && inspection.isPending) {
    return <Message title={t('invitations.page.loading')} text="" />;
  }
  if (wellFormed && inspection.isError) {
    return (
      <Message
        title={t('invitations.page.unreachableTitle')}
        text={t('invitations.page.failed')}
        action={
          <Button
            size="md"
            className="mt-[25px] h-12 w-[250px] rounded-[24px]"
            onClick={() => void inspection.refetch()}
          >
            {t('invitations.page.retry')}
          </Button>
        }
      />
    );
  }
  const view: InvitationView = inspection.data ?? { state: 'invalid' };
  switch (view.state) {
    case 'valid':
      return (
        <Chosen
          view={view}
          token={token}
          onDone={() => setDone(true)}
          onRefused={() => void inspection.refetch()}
        />
      );
    case 'expired':
      return (
        <Message
          title={t('invitations.page.expiredTitle')}
          text={t('invitations.page.expiredText')}
        />
      );
    case 'used':
      return (
        <Message
          title={t('invitations.page.usedTitle')}
          text={t('invitations.page.usedText')}
          action={<ToSignIn label={t('invitations.page.signIn')} />}
        />
      );
    case 'invalid':
      return (
        <Message
          title={t('invitations.page.invalidTitle')}
          text={t('invitations.page.invalidText')}
        />
      );
  }
}
