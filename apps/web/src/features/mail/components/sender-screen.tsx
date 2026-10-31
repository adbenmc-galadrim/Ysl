import type { DnsRecord, SenderSettings } from '@repo/contract/mail';
import { SENDER_NAME_MAX } from '@repo/contract/mail';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  Banner,
  Button,
  Field,
  FieldInput,
  GroupedFootnote,
  GroupedHeader,
  GroupedRow,
  GroupedSection,
  SettingsScreen,
} from '@repo/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { copyText } from '#/features/mail/fallback';
import { recordLine, recordsText } from '#/features/mail/sender-records';
import { trpcClient } from '#/lib/trpc';
import { useOnline } from '#/lib/use-online';

const t = createTranslator(DEFAULT_LOCALE);

const SENDER_KEY = ['mailSender', 'get'] as const;

const DATE = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
  day: 'numeric',
  month: 'long',
});

/** The server's refusals are written for the admin; anything else stays generic. */
function saveMessage(error: unknown): string {
  const { data, message } = error as {
    data?: { code?: string };
    message?: string;
  };
  return message && (data?.code === 'CONFLICT' || data?.code === 'BAD_REQUEST')
    ? message
    : t('sender.error.saveFailed');
}

function StatusBanner({ settings }: { settings: SenderSettings }) {
  const { sender, problem, platformAddress, providerConfigured } = settings;
  if (problem === 'taken') {
    return (
      <Banner
        tone="red"
        icon="alert"
        title={t('sender.taken.title')}
        description={t('sender.error.taken')}
      />
    );
  }
  if (problem === 'invalid') {
    return (
      <Banner
        tone="red"
        icon="alert"
        title={t('sender.invalid.title')}
        description={t('sender.error.invalid')}
      />
    );
  }
  if (!providerConfigured) {
    return (
      <Banner
        tone="orange"
        icon="alert"
        title={t('sender.unconfigured.title')}
        description={t('sender.unconfigured.description')}
      />
    );
  }
  if (problem === 'unavailable') {
    return (
      <Banner
        tone="red"
        icon="alert"
        title={t('sender.unavailable.title')}
        description={t('sender.unavailable.description')}
      />
    );
  }
  if (!sender) return null;
  if (sender.status === 'verified') {
    return (
      <Banner
        tone="green"
        icon="check"
        title={t('sender.verified.title', {
          domain: sender.domain,
          date: sender.verifiedAt ? DATE.format(sender.verifiedAt) : '',
        })}
        description={t('sender.verified.description', {
          address: sender.email,
        })}
      />
    );
  }
  return (
    <Banner
      tone="orange"
      icon="alert"
      title={t('sender.pending.title', { domain: sender.domain })}
      description={
        platformAddress
          ? t('sender.pending.platform', {
              address: platformAddress,
              name: sender.name,
            })
          : t('sender.pending.noPlatform')
      }
    />
  );
}

function RecordCard({
  record,
  onCopy,
}: {
  record: DnsRecord;
  onCopy: (text: string) => void;
}) {
  const line = recordLine(record, t);
  return (
    <div className="flex items-start gap-3 rounded-control bg-surface p-4">
      <div className="min-w-0 flex-1">
        <p className="text-13 font-semibold text-muted">{line}</p>
        <p className="mt-1 font-mono text-14 break-all">{record.value}</p>
        <p className="mt-1 text-13 text-muted">
          {t(
            record.configured
              ? 'sender.record.configured'
              : 'sender.record.missing',
          )}
        </p>
      </div>
      <Button
        variant="secondary"
        icon="copy"
        aria-label={t('sender.copy', { label: line })}
        onClick={() => onCopy(record.value)}
      />
    </div>
  );
}

/**
 * Réglages › Expéditeur des e-mails (admin, D28): the address a company sends
 * from, the DNS records for its IT, and the check. Until the domain is
 * verified, the server sends from the platform's address.
 */
export function SenderScreen() {
  const navigate = useNavigate();
  const online = useOnline();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<{ name: string; email: string } | null>(
    null,
  );

  const query = useQuery({
    queryKey: SENDER_KEY,
    queryFn: () => trpcClient.mailSender.get.query(),
    enabled: online,
  });
  const onResult = (result: SenderSettings) => {
    setDraft(null);
    queryClient.setQueryData(SENDER_KEY, result);
  };
  const save = useMutation({
    mutationFn: (input: { name: string; email: string }) =>
      trpcClient.mailSender.save.mutate(input),
    onSuccess: onResult,
  });
  const check = useMutation({
    mutationFn: () => trpcClient.mailSender.check.mutate(),
    onSuccess: onResult,
  });

  const [copied, setCopied] = useState<boolean | null>(null);
  const copy = (text: string) => {
    setCopied(null);
    void copyText(text).then(setCopied);
  };

  const settings = query.data;
  const sender = settings?.sender;
  const value = draft ?? {
    name: sender?.name ?? '',
    email: sender?.email ?? '',
  };
  const edit = (change: Partial<typeof value>) => {
    save.reset();
    setDraft({ ...value, ...change });
  };
  const placeholder = settings
    ? null
    : !online
      ? t('sender.offline')
      : query.isError
        ? t('sender.failed')
        : t('sender.loading');

  return (
    <SettingsScreen
      title={t('sender.title')}
      onBack={() => void navigate({ to: '/reglages' })}
    >
      {placeholder ? (
        <GroupedSection>
          <GroupedRow title={placeholder} />
        </GroupedSection>
      ) : (
        settings && (
          <div className="flex flex-col gap-4 px-4">
            <div role="status" className="flex flex-col gap-3">
              <StatusBanner settings={settings} />
              {save.isSuccess && !draft && !settings.problem && (
                <Banner tone="green" icon="check" title={t('sender.saved')} />
              )}
            </div>
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                save.mutate(value);
              }}
            >
              <Field label={t('sender.name')}>
                {(id) => (
                  <FieldInput
                    id={id}
                    className="bg-surface"
                    required
                    maxLength={SENDER_NAME_MAX}
                    value={value.name}
                    onChange={(event) => edit({ name: event.target.value })}
                  />
                )}
              </Field>
              <Field
                label={t('sender.email')}
                help={
                  save.isError ? (
                    <span role="alert">{saveMessage(save.error)}</span>
                  ) : (
                    t('sender.email.help')
                  )
                }
                helpTone={save.isError ? 'red' : 'muted'}
              >
                {(id) => (
                  <FieldInput
                    id={id}
                    className="bg-surface"
                    required
                    type="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    value={value.email}
                    onChange={(event) => edit({ email: event.target.value })}
                  />
                )}
              </Field>
              <Button
                type="submit"
                variant="secondary"
                block
                disabled={!draft || save.isPending || !online}
              >
                {t('sender.save')}
              </Button>
            </form>
            {sender && (
              <>
                <GroupedHeader className="mt-2 px-0">
                  {t(
                    sender.status === 'verified'
                      ? 'sender.records.headerVerified'
                      : 'sender.records.header',
                  )}
                </GroupedHeader>
                {sender.records.length ? (
                  sender.records.map((record) => (
                    <RecordCard
                      key={`${record.kind}:${record.host}`}
                      record={record}
                      onCopy={copy}
                    />
                  ))
                ) : (
                  <GroupedFootnote className="px-0">
                    {t('sender.records.pending')}
                  </GroupedFootnote>
                )}
                {sender.records.length > 0 && (
                  <>
                    <GroupedFootnote className="px-0">
                      {sender.status !== 'verified' &&
                        t('sender.records.footer')}
                      {sender.records.some(({ kind }) => kind === 'spf') &&
                        ` ${t('sender.records.spf')}`}
                    </GroupedFootnote>
                    <Button
                      variant="secondary"
                      icon="copy"
                      block
                      onClick={() => copy(recordsText(sender.records, t))}
                    >
                      {t('sender.copyAll')}
                    </Button>
                    <p
                      role="status"
                      className="min-h-[18px] text-13 text-muted"
                    >
                      {copied === null
                        ? ''
                        : t(copied ? 'sender.copied' : 'sender.copyFailed')}
                    </p>
                  </>
                )}
                {settings.providerConfigured && (
                  <Button
                    block
                    icon="refresh"
                    disabled={check.isPending || !online || draft !== null}
                    onClick={() => check.mutate()}
                  >
                    {t('sender.check')}
                  </Button>
                )}
                {check.isError && (
                  <p role="alert" className="text-13 text-red">
                    {t('sender.error.checkFailed')}
                  </p>
                )}
              </>
            )}
          </div>
        )
      )}
    </SettingsScreen>
  );
}
