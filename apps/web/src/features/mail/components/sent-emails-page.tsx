import { renderMail, type MailMessage } from '@repo/contract/mail';
import { newPickupToken } from '@repo/contract/pickup';
import type { PickupSetting } from '@repo/contract/settings';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  Banner,
  Button,
  FixAddressSheet,
  MailParcelsSheet,
  MailSentSheet,
  SentEmailsScreen,
  type SentEmail,
  type SentEmailsSection,
} from '@repo/ui';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useSession } from '#/features/auth/api/use-session';
import { db } from '#/features/db/database';
import type { LocalNotification, LocalParcel } from '#/features/db/schema';
import {
  cardOf,
  fixAddress,
  type AddressCard,
} from '#/features/mail/fix-address';
import { requestServerMails, useServerMail } from '#/features/mail/server-mail';
import { useAddressEntry } from '#/features/mail/use-address-entry';
import { MailFallback } from '#/features/mail/components/mail-fallback';
import { needsFallback } from '#/features/mail/fallback';
import { useMailTarget } from '#/features/mail/mail-target';
import { MAILERS } from '#/features/mail/mailer';
import {
  departmentOfParcels,
  drawSecrets,
  pickupToWrite,
  recallSecrets,
  type PickupSecret,
} from '#/features/mail/pickup-code';
import { parcelName, recipientValues } from '#/features/mail/recipients';
import {
  listTemplates,
  type EmailTemplateView,
} from '#/features/mail/templates';
import {
  countMails,
  filterMails,
  mailOf,
  mailStatusLine,
  mailSummary,
  type MailFilter,
  type TrackedMail,
  type TrackedState,
} from '#/features/mail/tracking';
import { useNotifications } from '#/features/mail/use-notifications';
import { useSentMails, type SentMails } from '#/features/mail/use-sent-mails';
import { whenVisible } from '#/features/mail/visibility';
import { EmployeeReply } from '#/features/replies/components/employee-reply';
import { readPickup } from '#/features/settings/pickup';

const t = createTranslator(DEFAULT_LOCALE);

const SECTIONS: { state: TrackedState; title: string }[] = [
  { state: 'failed', title: t('mails.section.failed') },
  { state: 'waiting', title: t('mails.section.waiting') },
  { state: 'sent', title: t('mails.section.sent') },
  { state: 'closed', title: t('mails.section.closed') },
];

const EMPTY: Record<MailFilter, string> = {
  all: t('mails.empty.all'),
  toConfirm: t('mails.empty.toConfirm'),
  failed: t('mails.empty.failed'),
  sent: t('mails.empty.sent'),
};

type Open =
  | { kind: 'confirm' | 'fix' | 'parcels'; id: string }
  /** Frozen at the tap: an answer takes parcels out of « notifié ». */
  | { kind: 'reply'; id: string; parcels: LocalParcel[] };

/** What a resend needs besides the address: read once the sheet opens. */
type Draft = {
  card: AddressCard;
  template: EmailTemplateView;
  pickup: PickupSetting;
  secret: PickupSecret | null;
};

async function openDraft(
  notification: LocalNotification,
  userId: string,
): Promise<Draft> {
  const [card, templates, pickup, pins] = await Promise.all([
    cardOf(db, notification),
    listTemplates(db, userId),
    readPickup(db),
    // A reminder quotes the code the employee already holds (F37).
    notification.type === 'relance'
      ? departmentOfParcels(db, notification.parcelIds).then((departmentId) =>
          recallSecrets(db, [{ ...notification, departmentId }]),
        )
      : drawSecrets(db, 1),
  ]);
  const ofType = templates.filter((row) => row.type === notification.type);
  const template =
    ofType.find((row) => row.id === notification.templateId) ??
    ofType.find((row) => row.isDefault) ??
    templates.find((row) => row.isDefault)!;
  return { card, template, pickup, secret: pins[0] ?? null };
}

function parcelDetail(parcel: LocalParcel | undefined): string {
  if (!parcel || parcel.deletedAt) return t('mails.parcel.deleted');
  return t(`mails.parcel.${parcel.status}`);
}

/**
 * Fixing the address of a mail that did not go, then sending it again. The
 * button is the mail app's link itself, rebuilt at each keystroke: iOS
 * opens a mail app only from the tap on a link. The tap writes the address,
 * records a new mail with a new pickup code (only its hash is kept, so the
 * old one cannot be quoted again), then asks, back from the mail app,
 * whether it left.
 */
function FixSheet({
  tracked,
  sent,
  onShowParcels,
  onDismiss,
  onAsk,
}: {
  tracked: TrackedMail;
  sent: SentMails;
  onShowParcels: () => void;
  onDismiss: () => void;
  onAsk: (id: string) => void;
}) {
  const session = useSession();
  const userId = session.user.id;
  const outbox = useNotifications();
  // Frozen at the tap on "Corriger": the live log moves under the sheet
  // (this very mail is replaced on resend) and must not redraw the code.
  const [notification] = useState(tracked.notification);
  const mail = mailOf(notification, sent.parcels, sent.context);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [failed, setFailed] = useState(false);
  // The mail app did not open (YSL-62): the fallback sheet takes over.
  const [stayed, setStayed] = useState<{
    id: string;
    message: MailMessage;
  } | null>(null);
  const target = useMailTarget();
  const serverMail = useServerMail();
  const busy = useRef(false);
  const entry = useAddressEntry(draft?.card ?? null, mail.address ?? '');
  const { address, onCard } = entry;

  useEffect(() => {
    let live = true;
    void openDraft(notification, userId).then((next) => {
      if (live) setDraft(next);
    });
    return () => {
      live = false;
    };
  }, [notification, userId]);

  const rendered =
    draft &&
    renderMail(
      draft.template,
      recipientValues(mail, {
        pickup: draft.pickup,
        agent: session.user.name,
        replyTo: session.user.email,
        code: draft.secret?.pin ?? null,
        now: new Date(),
        t,
      }),
    );
  const message: MailMessage | undefined =
    rendered && address && mail.parcels.length > 0
      ? { to: [address], subject: rendered.subject, body: rendered.body }
      : undefined;
  const prepared = message && MAILERS[target].prepare(message);

  const resendByServer = async () => {
    if (!draft || !address || busy.current) return;
    busy.current = true;
    setFailed(false);
    try {
      const parcelIds = mail.parcels.map(({ id }) => id);
      await fixAddress(
        db,
        { card: draft.card, parcelIds, address, onCard },
        { agentId: userId },
      );
      await requestServerMails(
        db,
        [{ ...mail, address }],
        notification.type === 'relance' ? 'relance' : 'avis',
        { userId },
      );
      onDismiss();
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
    }
  };

  const resend = (event: MouseEvent) => {
    if (serverMail) {
      event.preventDefault();
      void resendByServer();
      return;
    }
    if (!draft || !prepared || !message || !address || busy.current) {
      event.preventDefault();
      return;
    }
    busy.current = true;
    setFailed(false);
    const opening = MAILERS[target].open(prepared);
    // Recorded from the tap, as Notifier does: the new code's hash and the
    // mail to confirm exist even if iOS ends the app while Mail is open.
    const parcelIds = mail.parcels.map(({ id }) => id);
    const preparing = outbox.prepare({
      type: notification.type,
      personId: notification.personId,
      contactId: notification.contactId,
      recipients: [address],
      parcelIds,
      templateId: draft.template.stored ? draft.template.id : null,
      target,
      // A fresh token per try: a token is written once
      // (`pickup_code_token_hash_idx`), and this mail carries no QR.
      pickup: draft.secret
        ? pickupToWrite(
            { ...draft.secret, token: newPickupToken() },
            { withQr: false },
          )
        : undefined,
    });
    const fixing = fixAddress(
      db,
      { card: draft.card, parcelIds, address, onCard },
      { agentId: userId },
    );
    void (async () => {
      try {
        const row = await preparing;
        if (needsFallback(await opening)) {
          setStayed({ id: row.id, message });
          await fixing;
          return;
        }
        await outbox.markOpened(row.id);
        await whenVisible();
        // The mail left the app: ask about it even if the card was not
        // written, which the sheet then says.
        onAsk(row.id);
        await fixing;
      } catch {
        setFailed(true);
      } finally {
        busy.current = false;
      }
    })();
  };

  if (stayed)
    return (
      <MailFallback
        message={stayed.message}
        target={target}
        notificationId={stayed.id}
        onOpened={() => void whenVisible().then(() => onAsk(stayed.id))}
        onSent={onDismiss}
        onAbandoned={onDismiss}
        onClose={onDismiss}
      />
    );
  return (
    <FixAddressSheet
      fixed
      recipient={mail.name}
      description={
        mail.address
          ? t('mails.fix.description', { address: mail.address })
          : t('mails.fix.missing', { name: mail.name })
      }
      {...entry.fields(failed)}
      resendLabel={t('mails.fix.resend')}
      resendHref={prepared?.url ?? 'mailto:'}
      onResend={resend}
      onShowParcels={onShowParcels}
      onDismiss={onDismiss}
    />
  );
}

/**
 * Réglages › E-mails envoyés: the agent's own mails (D2: only the one whose
 * mail app opened a draft can say whether it left, unless the provider
 * reports a bounce), what failed first with
 * its fix, then what waits for an answer, then what left. Opened from a
 * parcel's record, the log keeps to that parcel's mails.
 */
export function SentEmailsPage({
  parcelId,
  initialFilter = 'all',
}: {
  parcelId?: string;
  initialFilter?: MailFilter;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const outbox = useNotifications();
  const sent = useSentMails();
  const [filter, setFilter] = useState<MailFilter>(initialFilter);
  const [open, setOpen] = useState<Open | null>(null);
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);

  const back = () => {
    if (router.history.canGoBack()) router.history.back();
    else void navigate({ to: '/reglages' });
  };

  if (!sent) return null;
  const now = new Date();
  const mine = parcelId ? filterMails(sent.mails, 'all', parcelId) : sent.mails;
  const counts = countMails(mine);
  const shown = filterMails(mine, filter);
  const byId = new Map(sent.mails.map((mail) => [mail.notification.id, mail]));
  // Sent through a contact (YSL-72): « Marc Petit · via Sophie Martin ».
  const nameOf = (mail: TrackedMail) => {
    const name = mailOf(mail.notification, sent.parcels, sent.context).name;
    const relay = mail.notification.relayName;
    return relay ? t('mails.row.via', { name, relay }) : name;
  };

  const toRow = (mail: TrackedMail): SentEmail => ({
    id: mail.notification.id,
    recipient: nameOf(mail),
    state: mail.state,
    summary: mailSummary(mail.notification, sent.parcels, t),
    status: mailStatusLine(mail, now, t),
  });
  const sections: SentEmailsSection[] = SECTIONS.map(({ state, title }) => ({
    title,
    emails: shown.filter((mail) => mail.state === state).map(toRow),
  }));

  const chip = (value: MailFilter, count?: number) => ({
    label: t(`mails.filter.${value}`),
    count: count || undefined,
    selected: filter === value,
    onClick: () => setFilter(value),
  });

  const answer = async (id: string, left: boolean) => {
    if (busy.current) return;
    busy.current = true;
    setFailed(false);
    try {
      if (left) await outbox.markSent(id);
      else await outbox.markFailed(id, t('notify.notSent.reason'));
      setOpen(null);
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
    }
  };

  const current = open && byId.get(open.id);
  // What the recipient may answer for: the parcels of the mail still
  // waiting as notified (YSL-70).
  const answerable = (mail: TrackedMail) =>
    mail.notification.parcelIds.flatMap((id) => {
      const row = sent.parcels.get(id);
      return row && !row.deletedAt && row.status === 'notifie' ? [row] : [];
    });
  const showParcels = () => open && setOpen({ kind: 'parcels', id: open.id });
  const sheet = !current ? undefined : open.kind === 'confirm' ? (
    <MailSentSheet
      recipient={nameOf(current)}
      onSent={() => void answer(current.notification.id, true)}
      onNotSent={() => void answer(current.notification.id, false)}
      onShowParcels={showParcels}
      onDismiss={() => setOpen(null)}
    />
  ) : open.kind === 'fix' ? (
    <FixSheet
      key={current.notification.id}
      tracked={current}
      sent={sent}
      onShowParcels={showParcels}
      onDismiss={() => setOpen(null)}
      onAsk={(id) => setOpen({ kind: 'confirm', id })}
    />
  ) : open.kind === 'reply' ? (
    <EmployeeReply
      parcels={open.parcels}
      recipient={nameOf(current)}
      onClose={() => setOpen(null)}
    />
  ) : (
    <MailParcelsSheet
      recipient={nameOf(current)}
      status={mailStatusLine(current, now, t)}
      parcels={current.notification.parcelIds.map((id) => {
        const parcel = sent.parcels.get(id);
        return {
          id,
          title: parcel ? parcelName(parcel, t) : t('mails.parcel.unknown'),
          detail: parcelDetail(parcel),
        };
      })}
      onParcel={(parcel) =>
        sent.parcels.get(parcel.id) &&
        void navigate({
          to: '/colis/$parcelId',
          params: { parcelId: parcel.id },
        })
      }
      onDismiss={() => setOpen(null)}
    >
      {current.state === 'sent' && answerable(current).length > 0 && (
        <Button
          variant="secondary"
          icon="mail"
          iconSize={20}
          block
          className="mt-4 text-16"
          onClick={() =>
            setOpen({
              kind: 'reply',
              id: current.notification.id,
              parcels: answerable(current),
            })
          }
        >
          {t('record.action.reply')}
        </Button>
      )}
    </MailParcelsSheet>
  );

  const parcel = parcelId ? sent.parcels.get(parcelId) : undefined;
  return (
    <SentEmailsScreen
      filters={[
        chip('all'),
        chip('toConfirm', counts.toConfirm),
        chip('failed', counts.failed),
        chip('sent'),
      ]}
      notice={
        failed ? (
          <Banner
            tone="red"
            icon="alert"
            title={t('notify.error')}
            className="mt-4"
          />
        ) : parcel ? (
          <Banner
            tone="blue"
            icon="package"
            title={t('mails.forParcel', { name: parcelName(parcel, t) })}
            description={t('mails.forParcel.all')}
            className="mt-4"
            onClick={() =>
              void navigate({ to: '/reglages/e-mails', search: {} })
            }
          />
        ) : undefined
      }
      sections={sections}
      empty={{ title: EMPTY[filter] }}
      onBack={back}
      onFix={(email) => {
        // Sent through a contact (YSL-72): the address was the contact's,
        // never the recipient's card to fix; the ways to tell them again.
        const relayed = byId.get(email.id)?.notification;
        const first = relayed?.relayName
          ? relayed.parcelIds.find((id) => sent.parcels.has(id))
          : undefined;
        if (first) {
          void navigate({
            to: '/notifier',
            search: { colis: first, prevenir: true },
          });
          return;
        }
        setOpen({ kind: 'fix', id: email.id });
      }}
      onConfirm={(email) => setOpen({ kind: 'confirm', id: email.id })}
      onOpen={(email) => setOpen({ kind: 'parcels', id: email.id })}
      sheet={sheet}
    />
  );
}
