import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  Banner,
  BottomBar,
  Button,
  Field,
  FieldInput,
  HeroTile,
  Icon,
  PageIntro,
  Screen,
} from '@repo/ui';
import { useForm } from '@tanstack/react-form';
import { useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { SignInError, useSignIn } from '#/features/auth/api/sign-in';

const t = createTranslator(DEFAULT_LOCALE);

const FORM_ID = 'sign-in-form';

const ERROR_MESSAGES = {
  invalid: t('auth.signIn.error.invalid'),
  rateLimited: t('auth.signIn.error.rateLimited'),
  network: t('auth.signIn.error.network'),
  unknown: t('auth.signIn.error.unknown'),
} as const;

export function SignInScreen({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const signIn = useSignIn();
  const [forgotShown, setForgotShown] = useState(false);

  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      try {
        await signIn.mutateAsync(value);
      } catch {
        return;
      }
      router.history.push(redirectTo ?? '/');
    },
  });

  const failure =
    signIn.error instanceof SignInError ? signIn.error.failure : 'unknown';

  return (
    <Screen
      bottom={
        <BottomBar>
          <Button
            block
            type="submit"
            form={FORM_ID}
            disabled={signIn.isPending}
          >
            {t('auth.signIn.submit')}
          </Button>
        </BottomBar>
      }
    >
      <HeroTile icon="package" tone="ink" size="md" className="mt-[62px]" />
      <PageIntro
        title={t('auth.signIn.title')}
        description={t('auth.signIn.description')}
        className="mt-5"
      />
      <form
        id={FORM_ID}
        className="flex flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <form.Field name="email">
          {(field) => (
            <Field label={t('auth.signIn.email')} className="mt-[47px]">
              {(id) => (
                <FieldInput
                  id={id}
                  name={field.name}
                  type="email"
                  autoComplete="username"
                  required
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              )}
            </Field>
          )}
        </form.Field>
        <form.Field name="password">
          {(field) => (
            <Field label={t('auth.signIn.password')} className="mt-[22px]">
              {(id) => (
                <FieldInput
                  id={id}
                  name={field.name}
                  type="password"
                  autoComplete="current-password"
                  required
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  trailing={
                    <Icon
                      name="lock"
                      size={20}
                      className="shrink-0 text-muted"
                    />
                  }
                />
              )}
            </Field>
          )}
        </form.Field>
      </form>
      {signIn.isError && (
        <div role="alert" className="mt-4">
          <Banner tone="red" icon="alert" title={ERROR_MESSAGES[failure]} />
        </div>
      )}
      <Button
        variant="link"
        className="mt-[18px] self-end text-15 font-medium"
        onClick={() => setForgotShown(true)}
      >
        {t('auth.signIn.forgot')}
      </Button>
      {forgotShown && (
        <div role="status" className="mt-4">
          <Banner
            tone="blue"
            icon="info"
            title={t('auth.signIn.forgotNotice')}
          />
        </div>
      )}
    </Screen>
  );
}
