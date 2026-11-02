import { dayKey, fromDayKey } from '@repo/contract/parcel-reply';
import { resumeOf } from '@repo/contract/reminders';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { isEmail } from '@repo/shared/text';
import {
  AbsenceJusquauSheet,
  ChoisirDestinataireScreen,
  ColisPasPourMoiSheet,
  CopieCollegueSheet,
  ReponseSalarieSheet,
} from '@repo/ui';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { useSession } from '#/features/auth/api/use-session';
import { useAccess } from '#/features/auth/use-access';
import { db } from '#/features/db/database';
import type { LocalParcel } from '#/features/db/schema';
import { useMailTarget } from '#/features/mail/mail-target';
import { MAILERS } from '#/features/mail/mailer';
import { parcelName } from '#/features/mail/recipients';
import { useServerMail } from '#/features/mail/server-mail';
import { assignRecipient } from '#/features/parcels/complete';
import { formatTime, shortDate } from '#/features/parcels/model';
import { loadRecipientBook } from '#/features/parcels/recipients';
import { RecipientChooser } from '#/features/recipient/components/recipient-chooser';
import { searchOptions } from '#/features/recipient/options';
import {
  copyDraft,
  recordPhoneCopy,
  sendServerCopy,
} from '#/features/replies/copy';
import {
  delegateName,
  replyAbsent,
  replyColleague,
  replyNotMine,
} from '#/features/replies/record';
import { trpcClient } from '#/lib/trpc';

const t = createTranslator(DEFAULT_LOCALE);

const WEEKDAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' });

type Step =
  | { kind: 'choose' }
  | { kind: 'which' }
  | { kind: 'colleague' }
  | { kind: 'copyWho' }
  | { kind: 'copy'; name: string; address: string }
  | { kind: 'absent' }
  | { kind: 'reassign'; parcel: LocalParcel };

export type EmployeeReplyProps = {
  /** The notified parcels the answer speaks for, oldest first. */
  parcels: readonly LocalParcel[];
  /** Who answered, as the sheet names them. */
  recipient: string;
  onClose: () => void;
};

/** « 2 colis », or the parcel itself: what the e-mail was about. */
function aboutOf(parcels: readonly LocalParcel[]): string {
  return parcels.length === 1
    ? parcelName(parcels[0]!, t)
    : t('reply.about.many', { count: parcels.length });
}

/**
 * « Le salarié a répondu » (YSL-70), from the record or from the sending
 * log: the three answers, then what each needs — which parcel and its
 * right recipient, the colleague's name, the last day away.
 */
export function EmployeeReply({
  parcels,
  recipient,
  onClose,
}: EmployeeReplyProps) {
  const session = useSession();
  const [step, setStep] = useState<Step>({ kind: 'choose' });
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const writing = useRef(false);
  const { receives } = useAccess();
  const options = { agentId: session.user.id, learns: receives };

  const write = async (change: () => Promise<unknown>, next?: () => void) => {
    if (writing.current) return;
    writing.current = true;
    setBusy(true);
    setFailed(false);
    try {
      await change();
      if (next) next();
      else onClose();
    } catch {
      setFailed(true);
    } finally {
      writing.current = false;
      setBusy(false);
    }
  };

  // A parcel handed over meanwhile (another iPhone) is not reopened.
  const notMine = (parcel: LocalParcel) => {
    let reopened = false;
    void write(
      async () => {
        reopened = (await replyNotMine(db, parcel.id, options)) === 'recorded';
      },
      () => (reopened ? setStep({ kind: 'reassign', parcel }) : onClose()),
    );
  };
  const ids = parcels.map(({ id }) => id);
  const error = failed ? t('record.error.write') : undefined;

  switch (step.kind) {
    case 'choose':
      return (
        <ReponseSalarieSheet
          fixed
          recipient={recipient}
          about={aboutOf(parcels)}
          error={error}
          onNotMine={() =>
            parcels.length === 1
              ? notMine(parcels[0]!)
              : setStep({ kind: 'which' })
          }
          onColleague={() => setStep({ kind: 'colleague' })}
          onCopy={() => setStep({ kind: 'copyWho' })}
          onAbsent={() => {
            setFailed(false);
            setStep({ kind: 'absent' });
          }}
          onDismiss={onClose}
        />
      );
    case 'which':
      return (
        <ColisPasPourMoiSheet
          fixed
          recipient={recipient}
          error={error}
          parcels={parcels.map((parcel) => ({
            id: parcel.id,
            title: parcelName(parcel, t),
            detail: t('reply.parcel.received', {
              date: shortDate(parcel.receivedAt, new Date()),
              time: formatTime(parcel.receivedAt),
            }),
          }))}
          onPick={({ id }) => {
            const parcel = parcels.find((row) => row.id === id);
            if (parcel) notMine(parcel);
          }}
          onDismiss={onClose}
        />
      );
    case 'reassign':
      // The name read stays the hint; closing leaves the parcel
      // « À compléter », its « Réattribuer » on Colis.
      return (
        <RecipientChooser
          readName={step.parcel.readName}
          onClose={onClose}
          onPick={(pick) =>
            write(() =>
              assignRecipient(
                db,
                step.parcel.id,
                pick.kind === 'card'
                  ? { kind: pick.choice.kind, id: pick.choice.id }
                  : { ...pick, kind: 'typed' },
                options,
              ),
            )
          }
        />
      );
    case 'colleague':
      return (
        <ColleagueChooser
          onClose={onClose}
          onPick={(name, address) =>
            void write(
              () => replyColleague(db, ids, name, options),
              () => setStep({ kind: 'copy', name, address }),
            )
          }
        />
      );
    case 'copyWho':
      return (
        <ColleagueChooser
          title={t('reply.copy.choose')}
          onClose={onClose}
          onPick={(name, address) => setStep({ kind: 'copy', name, address })}
        />
      );
    case 'copy':
      return (
        <CopySheet
          parcels={parcels}
          recipient={recipient}
          name={step.name}
          initialAddress={step.address}
          onClose={onClose}
        />
      );
    case 'absent':
      return (
        <AbsentSheet
          recipient={recipient}
          busy={busy}
          error={error}
          onClose={onClose}
          onSave={(day) => void write(() => replyAbsent(db, ids, day, options))}
        />
      );
  }
}

/** Who comes instead: a card of the directory or a contact, else the name as typed. */
function ColleagueChooser({
  title = t('reply.colleague.title'),
  onPick,
  onClose,
}: {
  title?: string;
  onPick: (name: string, address: string) => void;
  onClose: () => void;
}) {
  const book = useLiveQuery(() => loadRecipientBook(db), []);
  const [query, setQuery] = useState('');
  const typed = delegateName(query);
  const results = book
    ? searchOptions(book.people, book.contacts, query, book.names)
    : [];
  return (
    <div className="fixed inset-0 z-50">
      <ChoisirDestinataireScreen
        title={title}
        query={query}
        onQueryChange={setQuery}
        results={results}
        recents={[]}
        onClose={onClose}
        onPick={(id) => {
          const choice = results.find((option) => option.id === id);
          if (choice) onPick(choice.name, choice.email?.trim() ?? '');
        }}
        outsideTitle={
          typed
            ? t('reply.colleague.typed', { name: typed })
            : t('reply.colleague.outside')
        }
        outsideDescription={
          typed
            ? t('reply.colleague.typed.description')
            : t('reply.colleague.outside.description')
        }
        onOutside={() => typed && onPick(typed, '')}
      />
    </div>
  );
}

/**
 * The copy: the server sends the recipient's own QR and code; with its sending
 * off, the agent's mail app sends the text and the code.
 */
function CopySheet({
  parcels,
  recipient,
  name,
  initialAddress,
  onClose,
}: {
  parcels: readonly LocalParcel[];
  recipient: string;
  name: string;
  initialAddress: string;
  onClose: () => void;
}) {
  const session = useSession();
  const serverMail = useServerMail();
  const target = useMailTarget();
  const [address, setAddress] = useState(initialAddress);
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  const [draftHref, setDraftHref] = useState<string>();
  const clean = address.trim();
  const valid = isEmail(clean);
  const { user } = session;

  useEffect(() => {
    if (serverMail !== false || !valid) {
      setDraftHref(undefined);
      return;
    }
    let live = true;
    void copyDraft(
      db,
      parcels,
      { name, address: clean },
      { name: user.name, email: user.email },
    ).then((message) => {
      if (!live) return;
      setError(message ? undefined : t('reply.copy.noCode'));
      setDraftHref(message ? MAILERS[target].prepare(message).url : undefined);
    });
    return () => {
      live = false;
    };
  }, [serverMail, valid, clean, name, parcels, target, user.name, user.email]);

  const send = async () => {
    if (sending) return;
    if (serverMail === false) {
      if (draftHref) {
        void recordPhoneCopy(db, parcels, name, { agentId: user.id })
          // The mail app has the draft: a missing history line is no reason to hold the sheet.
          .catch(() => {})
          .finally(onClose);
      }
      return;
    }
    setSending(true);
    setError(undefined);
    const refused = await sendServerCopy(
      (input) => trpcClient.mail.sendCopy.mutate(input),
      parcels,
      { name, address: clean },
    );
    setSending(false);
    if (refused) setError(t(refused));
    else onClose();
  };

  return (
    <CopieCollegueSheet
      fixed
      recipient={recipient}
      name={name}
      address={address}
      onAddressChange={(value) => {
        setAddress(value);
        setError(undefined);
      }}
      help={t(
        serverMail === false
          ? 'reply.copy.help.phone'
          : 'reply.copy.help.server',
        { recipient },
      )}
      error={error}
      valid={valid && (serverMail === true || !!draftHref)}
      sending={sending}
      draftHref={draftHref}
      onSend={() => void send()}
      onSkip={onClose}
      onDismiss={onClose}
    />
  );
}

function AbsentSheet({
  recipient,
  busy,
  error,
  onSave,
  onClose,
}: {
  recipient: string;
  busy: boolean;
  error?: string;
  onSave: (day: Date) => void;
  onClose: () => void;
}) {
  const today = dayKey(new Date());
  const [value, setValue] = useState('');
  const valid = value !== '' && value >= today;
  const resume = valid ? resumeOf(fromDayKey(value)) : null;
  return (
    <AbsenceJusquauSheet
      fixed
      recipient={recipient}
      value={value}
      min={today}
      onValueChange={setValue}
      help={
        resume
          ? t('reply.absent.resume', {
              day: WEEKDAY.format(resume),
              date: shortDate(resume, new Date()),
            })
          : undefined
      }
      error={value !== '' && !valid ? t('reply.absent.past') : error}
      saving={busy || !valid}
      onSave={() => valid && onSave(fromDayKey(value))}
      onDismiss={onClose}
    />
  );
}
