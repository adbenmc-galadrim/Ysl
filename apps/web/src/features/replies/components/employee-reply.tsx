import { dayKey, fromDayKey } from '@repo/contract/parcel-reply';
import { resumeOf } from '@repo/contract/reminders';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  AbsenceJusquauSheet,
  ChoisirDestinataireScreen,
  ColisPasPourMoiSheet,
  ReponseSalarieSheet,
} from '@repo/ui';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { useSession } from '#/features/auth/api/use-session';
import { db } from '#/features/db/database';
import type { LocalParcel } from '#/features/db/schema';
import { parcelName } from '#/features/mail/recipients';
import { assignRecipient } from '#/features/parcels/complete';
import { formatTime, shortDate } from '#/features/parcels/model';
import { loadRecipientBook } from '#/features/parcels/recipients';
import { RecipientChooser } from '#/features/recipient/components/recipient-chooser';
import { searchOptions } from '#/features/recipient/options';
import {
  delegateName,
  replyAbsent,
  replyColleague,
  replyNotMine,
} from '#/features/replies/record';

const t = createTranslator(DEFAULT_LOCALE);

const WEEKDAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' });

type Step =
  | { kind: 'choose' }
  | { kind: 'which' }
  | { kind: 'colleague' }
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
  const options = { agentId: session.user.id };

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
          onPick={(name) =>
            void write(() => replyColleague(db, ids, name, options))
          }
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
  onPick,
  onClose,
}: {
  onPick: (name: string) => void;
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
        title={t('reply.colleague.title')}
        query={query}
        onQueryChange={setQuery}
        results={results}
        recents={[]}
        onClose={onClose}
        onPick={(id) => {
          const choice = results.find((option) => option.id === id);
          if (choice) onPick(choice.name);
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
        onOutside={() => typed && onPick(typed)}
      />
    </div>
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
