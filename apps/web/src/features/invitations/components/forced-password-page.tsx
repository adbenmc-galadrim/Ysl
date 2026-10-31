import { env } from '@repo/shared/env/web';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { CreerMotDePasseDesktop, CreerMotDePasseMobile } from '@repo/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { sessionQueryOptions } from '#/features/auth/api/session';
import {
  refusalMessage,
  usePasswordForm,
} from '#/features/invitations/password-form';
import { initialsOf } from '#/features/settings/initials';
import { trpcClient } from '#/lib/trpc';
import { DESK_WIDTH, useMediaQuery } from '#/lib/use-media-query';

const t = createTranslator(DEFAULT_LOCALE);

/** Signed in with the password an admin handed over: nothing opens until it is replaced. */
export function ForcedPasswordPage() {
  const desk = useMediaQuery(DESK_WIDTH);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const change = useMutation({
    mutationFn: (password: string) =>
      trpcClient.invitations.changeRequiredPassword.mutate({ password }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: sessionQueryOptions.queryKey,
      });
      await navigate({ to: '/' });
    },
  });
  const { fields, submit } = usePasswordForm({
    submitLabel: t('invitations.forced.submit'),
    error: refusalMessage(change.error),
    pending: change.isPending,
    onSubmit: (password) => change.mutate(password),
  });
  const logo = initialsOf(env.PUBLIC_APP_NAME);
  return desk ? (
    <CreerMotDePasseDesktop
      fluid
      logo={logo}
      brand={env.PUBLIC_APP_NAME}
      product=""
      footer={t('invitations.page.neutralFooter')}
      title={t('invitations.forced.title')}
      subtitle={t('invitations.forced.text')}
      form={
        <>
          {fields}
          <div className="mt-6">{submit}</div>
        </>
      }
    />
  ) : (
    <CreerMotDePasseMobile
      logo={logo}
      title={t('invitations.forced.title')}
      subtitle={t('invitations.forced.text')}
      form={fields}
      submit={submit}
    />
  );
}
