import {
  ANCHORS_MAX,
  ANCHOR_MAX,
  COMPANY_NAME_MAX,
  LOGO_MAX_BYTES,
  POSTAL_CODE_MAX,
} from '@repo/contract/company-settings';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  Button,
  CompanyLogo,
  DeskFormRow,
  DeskInput,
  DeskSectionTitle,
  Field,
  FieldInput,
  GroupedHeader,
} from '@repo/ui';
import { useMutation } from '@tanstack/react-query';
import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  CompanyFrame,
  companyPlaceholder,
} from '#/features/company/company-frame';
import { refusal, useCompany } from '#/features/company/use-company';
import { SenderSection } from '#/features/mail/components/sender-screen';
import { initialsOf } from '#/features/settings/initials';
import { logoUrl } from '#/features/settings/use-company-settings';
import { trpcClient } from '#/lib/trpc';
import { DESK_WIDTH, useMediaQuery } from '#/lib/use-media-query';

const t = createTranslator(DEFAULT_LOCALE);

function Section({
  title,
  description,
  desk,
  children,
}: {
  title: string;
  description?: string;
  desk: boolean;
  children: ReactNode;
}) {
  if (desk) {
    return (
      <section className="mt-6 flex shrink-0 flex-col gap-3 border-b border-separator pb-6 last:border-b-0">
        <DeskSectionTitle title={title} description={description} />
        {children}
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-3 px-4">
      <GroupedHeader className="px-0">{title}</GroupedHeader>
      {children}
    </section>
  );
}

function TextRow({
  desk,
  label,
  hint,
  value,
  onChange,
  maxLength,
  type = 'text',
  onBlur,
}: {
  desk: boolean;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  type?: string;
  onBlur?: () => void;
}) {
  if (desk) {
    return (
      <DeskFormRow label={label} hint={hint}>
        <DeskInput
          label={label}
          type={type}
          maxLength={maxLength}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
        />
      </DeskFormRow>
    );
  }
  return (
    <Field label={label} help={hint}>
      {(id) => (
        <FieldInput
          id={id}
          className="bg-surface"
          type={type}
          maxLength={maxLength}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
        />
      )}
    </Field>
  );
}

const Failure = ({ message }: { message: string }) => (
  <p role="alert" className="text-13 text-red">
    {message}
  </p>
);

const encode = async (file: File): Promise<string> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

function LogoRow({
  desk,
  name,
  logoId,
  refresh,
}: {
  desk: boolean;
  name: string;
  logoId: string | null;
  refresh: () => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [tooHeavy, setTooHeavy] = useState(false);
  const save = useMutation({
    mutationFn: async (file: File) =>
      trpcClient.company.saveLogo.mutate({
        contentBase64: await encode(file),
      }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => trpcClient.company.removeLogo.mutate(),
    onSuccess: refresh,
  });
  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setTooHeavy(file.size > LOGO_MAX_BYTES);
    save.reset();
    if (file.size <= LOGO_MAX_BYTES) save.mutate(file);
  };
  const url = logoUrl(logoId);
  const body = (
    <div className="flex flex-wrap items-center gap-3">
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        aria-label={t('company.logo')}
        onChange={choose}
      />
      {url ? (
        <img
          src={url}
          alt={t('company.logo.alt', { name })}
          className="size-14 rounded-[10px] object-contain"
        />
      ) : (
        <CompanyLogo muted size={56} initials={initialsOf(name)} />
      )}
      <Button
        variant="outline"
        size={desk ? 'desk' : undefined}
        disabled={save.isPending}
        onClick={() => input.current?.click()}
      >
        {t(url ? 'company.logo.replace' : 'company.logo.choose')}
      </Button>
      {url && (
        <Button
          variant="secondary"
          size={desk ? 'desk' : undefined}
          disabled={remove.isPending}
          onClick={() => remove.mutate()}
        >
          {t('company.logo.remove')}
        </Button>
      )}
      {tooHeavy && <Failure message={t('company.logo.error.size')} />}
      {save.isError && (
        <Failure message={refusal(save.error, t('company.saveFailed'))} />
      )}
      {remove.isError && <Failure message={t('company.saveFailed')} />}
    </div>
  );
  if (desk) {
    return (
      <DeskFormRow label={t('company.logo')} hint={t('company.logo.hint')}>
        {body}
      </DeskFormRow>
    );
  }
  return (
    <div>
      <p className="mb-2 text-13 font-semibold">{t('company.logo')}</p>
      {body}
      <p className="mt-2 text-13 text-muted">{t('company.logo.hint')}</p>
    </div>
  );
}

function IdentitySection({
  desk,
  name,
  logoId,
  refresh,
}: {
  desk: boolean;
  name: string;
  logoId: string | null;
  refresh: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (value: string) =>
      trpcClient.company.saveIdentity.mutate({ name: value }),
    onSuccess: async () => {
      await refresh();
      setDraft(null);
    },
  });
  return (
    <Section
      desk={desk}
      title={t('company.identity')}
      description={t('company.identity.description')}
    >
      <TextRow
        desk={desk}
        label={t('company.name')}
        maxLength={COMPANY_NAME_MAX}
        value={draft ?? name}
        onChange={setDraft}
      />
      {draft !== null && draft.trim() !== '' && draft !== name && (
        <div>
          <Button
            variant="secondary"
            size={desk ? 'desk' : undefined}
            disabled={save.isPending}
            onClick={() => save.mutate(draft)}
          >
            {t('company.save')}
          </Button>
        </div>
      )}
      {save.isError && <Failure message={t('company.saveFailed')} />}
      <LogoRow desk={desk} name={name} logoId={logoId} refresh={refresh} />
    </Section>
  );
}

const splitAnchors = (text: string) =>
  text
    .split(',')
    .map((anchor) => anchor.trim())
    .filter(Boolean)
    .slice(0, ANCHORS_MAX)
    .map((anchor) => anchor.slice(0, ANCHOR_MAX));

function ReceptionSection({
  desk,
  name,
  reception,
  refresh,
}: {
  desk: boolean;
  name: string;
  reception: { postalCode: string; anchors: string[] } | null;
  refresh: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<{
    postalCode: string;
    anchors: string;
  } | null>(null);
  const value = draft ?? {
    postalCode: reception?.postalCode ?? '',
    anchors: reception?.anchors.join(', ') ?? name,
  };
  const save = useMutation({
    mutationFn: () => {
      const postalCode = value.postalCode.trim();
      return trpcClient.company.saveReception.mutate({
        reception: postalCode
          ? { postalCode, anchors: splitAnchors(value.anchors) }
          : null,
      });
    },
    onSuccess: async () => {
      await refresh();
      setDraft(null);
    },
  });
  return (
    <Section
      desk={desk}
      title={t('company.reception')}
      description={t('company.reception.description')}
    >
      <TextRow
        desk={desk}
        label={t('company.reception.postalCode')}
        hint={t('company.reception.postalCode.hint')}
        maxLength={POSTAL_CODE_MAX}
        value={value.postalCode}
        onChange={(postalCode) => setDraft({ ...value, postalCode })}
      />
      <TextRow
        desk={desk}
        label={t('company.reception.anchors')}
        hint={t('company.reception.anchors.hint')}
        value={value.anchors}
        onChange={(anchors) => setDraft({ ...value, anchors })}
      />
      {draft && (
        <div>
          <Button
            variant="secondary"
            size={desk ? 'desk' : undefined}
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {t('company.save')}
          </Button>
        </div>
      )}
      {save.isError && <Failure message={t('company.saveFailed')} />}
    </Section>
  );
}

function ReplyRow({
  desk,
  department,
  refresh,
}: {
  desk: boolean;
  department: { id: string; name: string; replyEmail: string | null };
  refresh: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (replyEmail: string | null) =>
      trpcClient.company.saveDepartmentReply.mutate({
        id: department.id,
        replyEmail,
      }),
    onSuccess: async () => {
      await refresh();
      setDraft(null);
    },
  });
  return (
    <>
      <TextRow
        desk={desk}
        label={department.name}
        type="email"
        value={draft ?? department.replyEmail ?? ''}
        onChange={setDraft}
        onBlur={() => {
          if (draft === null) return;
          save.mutate(draft.trim() || null);
        }}
      />
      {save.isError && <Failure message={t('company.reply.invalid')} />}
    </>
  );
}

/**
 * Réglages › Identité et e-mails (admin, D28, mockup 16): what the app and the
 * e-mails show of the company, where it receives, who sends and who answers.
 */
export function IdentityScreen() {
  const desk = useMediaQuery(DESK_WIDTH);
  const { query, online, refresh } = useCompany();
  const company = query.data;
  return (
    <CompanyFrame tab="identity" title={t('company.identity.title')}>
      {!company ? (
        <p className="p-4 text-14 text-muted">
          {companyPlaceholder(online, query.isError)}
        </p>
      ) : (
        <div className={desk ? 'flex flex-col' : 'flex flex-col gap-6 pb-8'}>
          <IdentitySection
            desk={desk}
            name={company.name}
            logoId={company.logoId}
            refresh={refresh}
          />
          <ReceptionSection
            key={company.reception?.postalCode ?? 'none'}
            desk={desk}
            name={company.name}
            reception={company.reception}
            refresh={refresh}
          />
          <Section desk={desk} title={t('sender.title')}>
            <SenderSection desk={desk} />
          </Section>
          {company.departments.length > 0 && (
            <Section
              desk={desk}
              title={t('company.reply')}
              description={t('company.reply.description')}
            >
              {company.departments.map((department) => (
                <ReplyRow
                  key={department.id}
                  desk={desk}
                  department={department}
                  refresh={refresh}
                />
              ))}
            </Section>
          )}
        </div>
      )}
    </CompanyFrame>
  );
}
