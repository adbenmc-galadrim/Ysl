import { MIN_CHOSEN_PASSWORD_LENGTH } from '@repo/contract/auth';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { Banner, Button, Field, FieldInput, PasswordRules } from '@repo/ui';
import { useState } from 'react';

const t = createTranslator(DEFAULT_LOCALE);

const FORM_ID = 'password-form';

/** The fields and the button apart: on the phone the button sits in the bottom bar. */
export function usePasswordForm({
  submitLabel,
  error,
  pending,
  onSubmit,
}: {
  submitLabel: string;
  error?: string;
  pending: boolean;
  onSubmit: (password: string) => void;
}) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const longEnough = password.length >= MIN_CHOSEN_PASSWORD_LENGTH;
  const same = password.length > 0 && password === confirmation;
  const fields = (
    <form
      id={FORM_ID}
      className="flex flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (longEnough && same) onSubmit(password);
      }}
    >
      <Field label={t('invitations.page.password')} className="mt-7">
        {(id) => (
          <FieldInput
            id={id}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        )}
      </Field>
      <Field label={t('invitations.page.confirm')} className="mt-4">
        {(id) => (
          <FieldInput
            id={id}
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        )}
      </Field>
      <PasswordRules
        rules={[
          {
            label: t('invitations.page.ruleLength', {
              min: MIN_CHOSEN_PASSWORD_LENGTH,
            }),
            ok: longEnough,
          },
          { label: t('invitations.page.ruleSame'), ok: same },
        ]}
      />
      {error && (
        <div role="alert" className="mt-4">
          <Banner tone="red" icon="alert" title={error} />
        </div>
      )}
    </form>
  );
  const submit = (
    <Button
      block
      type="submit"
      form={FORM_ID}
      disabled={pending || !longEnough || !same}
    >
      {submitLabel}
    </Button>
  );
  return { fields, submit };
}

/** What the server said, unless it is zod's JSON or a failure that says nothing. */
export function refusalMessage(error: unknown): string | undefined {
  if (!error) return undefined;
  const code = (error as { data?: { code?: string } }).data?.code;
  const { message } = error as Error;
  return code === 'BAD_REQUEST' && !message.startsWith('[')
    ? message
    : t('invitations.page.failed');
}
