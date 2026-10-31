import {
  inviteCompanyAdminInput,
  type LinkDelivery,
} from '@repo/contract/accounts';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { Button, FieldInput, Sheet } from '@repo/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { LinkSheet } from '#/features/invitations/components/link-sheet';
import { trpcClient } from '#/lib/trpc';

const t = createTranslator(DEFAULT_LOCALE);

/**
 * The app's admin gives a company its first admin, or a new one when none is
 * left: it types a name and an address, and the screen keeps neither (D26).
 */
export function InviteCompanyAdmin({
  organizationId,
  afterCreation = false,
  onClose,
}: {
  organizationId: string;
  /** Last step of the creation wizard: the sheet says so. */
  afterCreation?: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [delivery, setDelivery] = useState<LinkDelivery | null>(null);
  const queryClient = useQueryClient();
  const invite = useMutation({
    mutationFn: (typed: { name: string; email: string; copy: boolean }) =>
      trpcClient.invitations.inviteCompanyAdmin.mutate({
        organizationId,
        ...typed,
      }),
    onSuccess: setDelivery,
    // A refusal too: it leaves its line in the journal.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['platform'] });
    },
  });
  if (delivery) {
    return (
      <LinkSheet
        delivery={delivery}
        onClose={onClose}
        onCopyInstead={() => invite.mutate({ name, email, copy: true })}
      />
    );
  }
  const refused = (invite.error as { data?: { code?: string } } | null)?.data
    ?.code;
  return (
    <Sheet
      fixed
      title={
        afterCreation
          ? t('invitations.admin.titleStep')
          : t('invitations.admin.title')
      }
      description={
        invite.isError
          ? refused === 'CONFLICT' || refused === 'NOT_FOUND'
            ? invite.error.message
            : t('accounts.failed')
          : t('invitations.admin.description')
      }
      className="pb-[calc(var(--safe-bottom)+16px)]"
      onDismiss={onClose}
    >
      <FieldInput
        id="invite-admin-name"
        aria-label={t('invitations.admin.name')}
        placeholder={t('invitations.admin.name')}
        autoComplete="off"
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="mt-4"
      />
      <FieldInput
        id="invite-admin-email"
        type="email"
        aria-label={t('invitations.admin.email')}
        placeholder={t('invitations.admin.email')}
        autoComplete="off"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="mt-3"
      />
      <Button
        block
        className="mt-6"
        disabled={
          invite.isPending ||
          !inviteCompanyAdminInput.safeParse({ organizationId, name, email })
            .success
        }
        onClick={() => invite.mutate({ name, email, copy: false })}
      >
        {t('invitations.admin.submit')}
      </Button>
      <Button variant="secondary" block className="mt-3" onClick={onClose}>
        {t('accounts.cancel')}
      </Button>
    </Sheet>
  );
}
