import {
  RELAY_TEMPLATES,
  renderMail,
  type MailMessage,
  type MailTarget,
  type NotifyChange,
} from '@repo/contract/mail';
import { newPickupToken } from '@repo/contract/pickup';
import type { PickupSetting } from '@repo/contract/settings';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  Button,
  EmptyState,
  MailSentSheet,
  NavBar,
  NotifierScreen,
  Screen,
  Sheet,
  type NotifierMailState,
} from '@repo/ui';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useSession } from '#/features/auth/api/use-session';
import { db } from '#/features/db/database';
import { MailFallback } from '#/features/mail/components/mail-fallback';
import { NotifyWayFlow } from '#/features/mail/components/notify-way-flow';
import {
  canShareFiles,
  needsFallback,
  shareMailWithFiles,
} from '#/features/mail/fallback';
import { useMailTarget } from '#/features/mail/mail-target';
import { MAILERS } from '#/features/mail/mailer';
import {
  informOrally,
  recordRelay,
  type Relay,
} from '#/features/mail/notify-ways';
import {
  drawSecrets,
  pickupToWrite,
  recallSecrets,
  type PickupSecret,
} from '#/features/mail/pickup-code';
import { pickupQrFile } from '#/features/mail/pickup-qr';
import {
  mailsAbout,
  mailsOfBatch,
  recipientValues,
  type RecipientMail,
} from '#/features/mail/recipients';
import {
  listTemplates,
  type EmailTemplateView,
} from '#/features/mail/templates';
import { loadPendingMails } from '#/features/mail/pending-mails';
import { loadReminderMails } from '#/features/mail/reminder-mails';
import { pageAfter, pickTemplate } from '#/features/mail/round';
import { useNotifications } from '#/features/mail/use-notifications';
import { whenVisible } from '#/features/mail/visibility';
import { templateWarnings } from '#/features/mail/warnings';
import { initialsOf } from '#/features/settings/initials';
import { type MailSkips, skipsLine } from '#/features/parcels/selection';
import {
  loadSelectionMails,
  selectionSecrets,
} from '#/features/mail/selection-mails';
import { readPickup } from '#/features/settings/pickup';

const t = createTranslator(DEFAULT_LOCALE);

/**
 * Every mail to send, one recipient's (from a record), one batch's, or
 * those of the parcels ticked on Colis (`selection`). `reminder`: the
 * reminders due instead of the notices (F37), one recipient's with
 * `parcelId`, or the selection's.
 */
export type NotifierScope = {
  parcelId?: string;
  batchId?: string;
  reminder?: boolean;
  /** Opens on the first recipient without an address, on « Comment le prévenir ? ». */
  otherWay?: boolean;
  /**
   * Parcels ticked on Colis (F31): only those, one mail per person and per department; the
   * notices first, then `then`, the reminders of those notified only.
   */
  selection?: readonly string[];
  then?: readonly string[];
  /** What the selection left out, said on the first page. */
  skipped?: MailSkips;
};

type Session = {
  mails: RecipientMail[];
  secrets: PickupSecret[];
  templates: EmailTemplateView[];
  pickup: PickupSetting;
  now: Date;
};

/** The mails that can be sent first, those without an address after (YSL-72). */
const addressedFirst = (mails: RecipientMail[]) => [
  ...mails.filter((mail) => mail.address),
  ...mails.filter((mail) => !mail.address),
];

/**
 * The mails as they stood when the screen opened: a mail confirmed makes
 * its parcels "Notifié", and a live list would drop the page under the
 * agent's thumb.
 */
async function openSession(
  userId: string,
  { parcelId, batchId, reminder, selection }: NotifierScope,
): Promise<Session> {
  const now = new Date();
  if (selection) {
    const mails = addressedFirst(
      await loadSelectionMails(db, selection, reminder === true),
    );
    const type = reminder ? 'relance' : 'avis';
    const [secrets, templates, pickup] = await Promise.all([
      selectionSecrets(db, mails, reminder === true, now),
      listTemplates(db, userId),
      readPickup(db),
    ]);
    return {
      mails,
      secrets,
      templates: templates.filter((template) => template.type === type),
      pickup,
      now,
    };
  }
  if (reminder) {
    const all = await loadReminderMails(db, now);
    // « Relancer les N » sends: those without an address are told apart.
    const mails = addressedFirst(
      parcelId
        ? mailsAbout(all, parcelId)
        : all.filter((mail) => mail.due && mail.address),
    );
    const [secrets, templates, pickup] = await Promise.all([
      recallSecrets(db, mails, { now }),
      listTemplates(db, userId),
      readPickup(db),
    ]);
    return {
      mails,
      secrets,
      templates: templates.filter((template) => template.type === 'relance'),
      pickup,
      now,
    };
  }
  const all = await loadPendingMails(db);
  const mails = addressedFirst(
    parcelId
      ? mailsAbout(all, parcelId)
      : batchId
        ? mailsOfBatch(all, batchId)
        : all,
  );
  const [secrets, templates, pickup] = await Promise.all([
    drawSecrets(db, mails.length, { now }),
    listTemplates(db, userId),
    readPickup(db),
  ]);
  return {
    mails,
    secrets,
    templates: templates.filter((template) => template.type === 'avis'),
    pickup,
    now,
  };
}

type Sent = {
  state: NotifierMailState;
  count?: number;
  reason?: string;
  /** Told in person: the PIN to give them, shown until the page is left. */
  code?: string;
};

/**
 * One mail per recipient of the "À notifier" parcels (F34), of one
 * parcel's recipient when opened from its record, or of the recipients of
 * a batch just saved (« Lot enregistré »). Each "Envoyer" opens the
 * mail app chosen in Réglages on a real link (S5); the agent then says
 * whether it left, and only a "yes" notifies the parcels (D2, declarative
 * follow-up). When the page stays in front, the fallback sheet offers the
 * other apps, the text to copy or share, and how it ended.
 */
export function NotifierPage({
  parcelId,
  batchId,
  reminder,
  otherWay,
  selection,
  then,
  skipped,
}: NotifierScope) {
  const navigate = useNavigate();
  const router = useRouter();
  const session = useSession();
  const userId = session.user.id;
  const outbox = useNotifications();
  const [opened, setOpened] = useState<Session | null>(null);
  const [index, setIndex] = useState(0);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [waying, setWaying] = useState(false);
  const [relays, setRelays] = useState<
    Record<string, Relay & { collects: boolean }>
  >({});
  const [asking, setAsking] = useState<{ key: string; id: string } | null>(
    null,
  );
  const [done, setDone] = useState<Record<string, Sent>>({});
  const [failed, setFailed] = useState(false);
  const chosenTarget = useMailTarget();
  // The app that opened on a retry carries the rest of the round: the chosen
  // one just failed, and every next mail would fall back again.
  const [roundTarget, setRoundTarget] = useState<MailTarget | null>(null);
  const mailTarget = roundTarget ?? chosenTarget;
  const [stayed, setStayed] = useState<{
    key: string;
    id: string;
    message: MailMessage;
    target: MailTarget;
  } | null>(null);
  const busy = useRef(false);
  // The page's QR, drawn before the tap: the share sheet opens only from
  // the tap itself, with nothing awaited before it.
  const [qr, setQr] = useState<{ token: string; file: File } | null>(null);
  const token = opened?.secrets[index]?.token;

  useEffect(() => {
    let live = true;
    void openSession(userId, {
      parcelId,
      batchId,
      reminder,
      selection,
    }).then((value) => {
      if (!live) return;
      setOpened(value);
      const first = value.mails.findIndex((mail) => !mail.address);
      if (otherWay && first >= 0) {
        setIndex(first);
        setWaying(true);
      }
    });
    return () => {
      live = false;
    };
  }, [userId, parcelId, batchId, reminder, otherWay, selection]);

  useEffect(() => {
    if (!token) return;
    let live = true;
    void pickupQrFile(token)
      .then((file) => {
        if (live && canShareFiles([file])) setQr({ token, file });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [token]);

  const back = () => {
    if (router.history.canGoBack()) router.history.back();
    else void navigate({ to: '/' });
  };

  if (!opened) return null;
  const { mails, secrets, templates, pickup, now } = opened;
  const mail = mails[index];
  if (!mail) {
    return (
      <Screen tone="fill">
        <NavBar title={t('notify.title')} onBack={back} />
        <EmptyState
          icon="mail"
          title={t(reminder ? 'remind.empty.title' : 'notify.empty.title')}
          description={t(
            reminder ? 'remind.empty.description' : 'notify.empty.description',
          )}
          className="mt-[129px]"
        />
      </Screen>
    );
  }

  const template = pickTemplate(templates, templateId)!;
  const relay = relays[mail.key];
  const address = relay?.address ?? mail.address;
  const secret = secrets[index];
  const code = secret?.pin ?? null;
  const values = recipientValues(mail, {
    pickup,
    agent: session.user.name,
    replyTo: session.user.email,
    code,
    now,
    t,
  });
  // Through a contact: the fixed text that says whose parcels, `{prénom}`
  // being the recipient's whole name.
  const rendered = relay
    ? renderMail(RELAY_TEMPLATES[reminder ? 'relance' : 'avis'], {
        ...values,
        prénom: mail.name,
      })
    : renderMail(template, values);
  const message: MailMessage | undefined = address
    ? { to: [address], subject: rendered.subject, body: rendered.body }
    : undefined;
  const prepared = message && MAILERS[mailTarget].prepare(message);
  const sent = done[mail.key];
  const state: NotifierMailState =
    sent?.code !== undefined
      ? 'sent'
      : !address
        ? sent?.state === 'failed'
          ? 'failed'
          : 'missing'
        : (sent?.state ?? 'ready');
  const missingCount = mails.filter(
    (other) => !other.address && !relays[other.key] && !done[other.key]?.code,
  ).length;
  const firstName =
    (relay ? relay.name : (mail.firstName ?? mail.name)).split(/\s+/)[0] ?? '';
  const record = () =>
    void navigate({
      to: '/colis/$parcelId',
      params: { parcelId: mail.parcels[0]!.id },
    });
  const last = index === mails.length - 1;

  // A token is written once (`pickup_code_token_hash_idx`): a second try on
  // this page, after a "no", quotes the same PIN with a new token.
  const renewToken = () =>
    setOpened({
      ...opened,
      secrets: secrets.map((other, at) =>
        at === index ? { ...other, token: newPickupToken() } : other,
      ),
    });

  const send = (event: MouseEvent) => {
    if (!prepared || !message || !address || busy.current) {
      event.preventDefault();
      return;
    }
    busy.current = true;
    setFailed(false);
    const opening = MAILERS[mailTarget].open(prepared);
    const preparing = outbox.prepare({
      type: template.type,
      personId: mail.personId,
      contactId: mail.contactId,
      recipients: [address],
      parcelIds: mail.parcels.map(({ id }) => id),
      templateId: !relay && template.stored ? template.id : null,
      target: mailTarget,
      pickup: pickupToWrite(secret, { withQr: false }),
      relayName: relay?.name ?? null,
    });
    renewToken();
    void (async () => {
      try {
        const row = await preparing;
        // Whoever was chosen is offered first next time, even if the
        // mail is confirmed later, from the sending log.
        if (relay)
          void recordRelay(db, { mail, relay, collects: false }).catch(
            () => {},
          );
        const outcome = await opening;
        if (needsFallback(outcome)) {
          setStayed({
            key: mail.key,
            id: row.id,
            message,
            target: mailTarget,
          });
          return;
        }
        await outbox.markOpened(row.id);
        await whenVisible();
        setAsking({ key: mail.key, id: row.id });
      } catch {
        setFailed(true);
      } finally {
        busy.current = false;
      }
    })();
  };

  const shareFile = qr && qr.token === secret?.token ? qr.file : null;

  // The share sheet takes the text and the QR, never the address: the agent
  // types it in the mail app (S5). The mail is recorded as for "Envoyer",
  // without a mail app; a closed sheet gives it up, as the fallback does.
  const share = () => {
    if (!message || !shareFile || !address || busy.current) return;
    busy.current = true;
    setFailed(false);
    const sharing = shareMailWithFiles(message, [shareFile]);
    const preparing = outbox.prepare({
      type: template.type,
      personId: mail.personId,
      contactId: mail.contactId,
      recipients: [address],
      parcelIds: mail.parcels.map(({ id }) => id),
      templateId: !relay && template.stored ? template.id : null,
      target: null,
      pickup: pickupToWrite(secret, { withQr: true }),
      relayName: relay?.name ?? null,
    });
    renewToken();
    const key = mail.key;
    void (async () => {
      try {
        const row = await preparing;
        // Whoever was chosen is offered first next time, even if the
        // mail is confirmed later, from the sending log.
        if (relay)
          void recordRelay(db, { mail, relay, collects: false }).catch(
            () => {},
          );
        const outcome = await sharing;
        if (outcome === 'shared') {
          await whenVisible();
          setAsking({ key, id: row.id });
          return;
        }
        await outbox.markFailed(
          row.id,
          t(
            outcome === 'cancelled'
              ? 'notify.share.reason'
              : 'notify.share.refused',
          ),
        );
        setDone((all) => ({
          ...all,
          [key]: {
            state: 'failed',
            reason:
              outcome === 'blocked'
                ? t('mail.fallback.shareBlocked')
                : outcome === 'cancelled'
                  ? t('mail.fallback.shareCancelled')
                  : t('mail.fallback.shareUnavailable'),
          },
        }));
      } catch {
        setFailed(true);
      } finally {
        busy.current = false;
      }
    })();
  };

  const confirmSent = (key: string, changes: NotifyChange[]) => {
    const count = changes.filter((change) => !('skip' in change)).length;
    setDone((all) => ({ ...all, [key]: { state: 'sent', count } }));
    setIndex(pageAfter(index, mails.length, 'sent'));
    const through = relays[key];
    const about = mails.find((other) => other.key === key);
    if (through && about) {
      void recordRelay(db, {
        mail: about,
        relay: through,
        collects: through.collects,
      }).catch(() => {});
    }
  };

  // Told in person: the parcels notified and the code given, nothing to send.
  const informed = async () => {
    if (!secret) throw new Error('no pickup code');
    const { changes, written } = await informOrally(
      db,
      { mail, secret, reminder: !!reminder },
      { userId },
    );
    // Told or handed over from elsewhere since the page opened: no code was
    // written, none to read out.
    if (!written) {
      setDone((all) => ({
        ...all,
        [mail.key]: { state: 'failed', reason: t('notify.voice.none') },
      }));
      setWaying(false);
      return;
    }
    const count = changes.filter((change) => !('skip' in change)).length;
    setDone((all) => ({
      ...all,
      [mail.key]: { state: 'sent', count, code: secret.pin },
    }));
    setWaying(false);
  };

  const answer = async (left: boolean) => {
    if (!asking || busy.current) return;
    busy.current = true;
    try {
      if (left) {
        const { changes } = await outbox.markSent(asking.id);
        confirmSent(asking.key, changes);
      } else {
        await outbox.markFailed(asking.id, t('notify.notSent.reason'));
        setDone((all) => ({ ...all, [asking.key]: { state: 'failed' } }));
        setIndex(pageAfter(index, mails.length, 'failed'));
      }
      setAsking(null);
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
    }
  };

  const skippedLine =
    index === 0 && skipped ? skipsLine(skipped, t) : undefined;
  const notice = failed
    ? { title: t('notify.error') }
    : sent?.code !== undefined
      ? {
          title: t('notify.voice.code', { code: sent.code }),
          description: t(
            reminder
              ? sent.count === 1
                ? 'notify.voice.reminder.one'
                : 'notify.voice.reminder.many'
              : sent.count === 1
                ? 'notify.voice.one'
                : 'notify.voice.many',
            { count: sent.count ?? 0 },
          ),
        }
      : state === 'missing'
        ? {
            title: t(
              missingCount > 1 ? 'notify.missing.many' : 'notify.missing.one',
              { count: missingCount },
            ),
            description: t('notify.missing.description'),
          }
        : state === 'sent'
          ? {
              title: t('notify.sent.title'),
              description: t(
                reminder
                  ? sent?.count === 1
                    ? 'remind.sent.one'
                    : 'remind.sent.many'
                  : sent?.count === 1
                    ? 'notify.sent.one'
                    : 'notify.sent.many',
                { count: sent?.count ?? 0 },
              ),
            }
          : state === 'failed'
            ? {
                title: t('notify.notSent.title'),
                description: sent?.reason ?? t('notify.notSent.description'),
              }
            : skippedLine
              ? { title: skippedLine }
              : undefined;

  // The notices of a selection sent, its reminders follow (one per person).
  const finish = () =>
    void (then?.length
      ? navigate({
          to: '/notifier',
          search: { selection: [...then], relance: true },
          replace: true,
        })
      : navigate({ to: '/' }));

  return (
    <NotifierScreen
      position={index + 1}
      total={mails.length}
      recipient={{
        name: mail.name,
        initials: initialsOf(mail.name),
        email: relay
          ? t('notify.relay.via', { name: relay.name, address: relay.address })
          : (mail.address ?? undefined),
        missing: address ? undefined : t('notify.missing'),
        onClick: record,
      }}
      state={state}
      template={
        relay
          ? { name: RELAY_TEMPLATES[reminder ? 'relance' : 'avis'].name }
          : {
              name: template.name,
              onClick:
                templates.length > 1 ? () => setChoosing(true) : undefined,
            }
      }
      onEditTemplate={
        relay
          ? undefined
          : () =>
              void navigate({
                to: '/reglages/modeles-email/$templateId',
                params: { templateId: template.id },
              })
      }
      preview={rendered}
      warnings={templateWarnings(rendered, t)}
      sendLabel={
        sent?.code !== undefined
          ? t('notify.voice.done')
          : state === 'sent'
            ? t('notify.sent.title')
            : t('notify.send', { name: firstName })
      }
      sendHref={prepared?.url}
      onSend={send}
      shareLabel={t('notify.share')}
      shareHint={t('notify.share.hint')}
      onShare={shareFile && address ? share : undefined}
      completeLabel={t('notify.way.open')}
      onComplete={() => setWaying(true)}
      notice={notice}
      nextLabel={last ? t('notify.finish') : t('notify.next')}
      onNext={() => (last ? finish() : setIndex(index + 1))}
      onBack={back}
      sheet={
        stayed ? (
          <MailFallback
            message={stayed.message}
            target={stayed.target}
            notificationId={stayed.id}
            onOpened={(opened) => {
              setRoundTarget(opened);
              const { key, id } = stayed;
              setStayed(null);
              void whenVisible().then(() => setAsking({ key, id }));
            }}
            onSent={({ changes }) => {
              confirmSent(stayed.key, changes);
              setStayed(null);
            }}
            onAbandoned={() => {
              setDone((all) => ({
                ...all,
                [stayed.key]: { state: 'failed' },
              }));
              setIndex(pageAfter(index, mails.length, 'failed'));
              setStayed(null);
            }}
          />
        ) : asking ? (
          <MailSentSheet
            recipient={
              mails.find((other) => other.key === asking.key)?.name ?? mail.name
            }
            description={
              reminder
                ? t('remind.question', {
                    name:
                      mails.find((other) => other.key === asking.key)?.name ??
                      mail.name,
                  })
                : undefined
            }
            onSent={() => void answer(true)}
            onNotSent={() => void answer(false)}
          />
        ) : waying ? (
          <NotifyWayFlow
            key={mail.key}
            mail={mail}
            reminder={reminder}
            onAddress={(typed) => {
              setOpened({
                ...opened,
                mails: mails.map((other) =>
                  other.key === mail.key ? { ...other, address: typed } : other,
                ),
              });
              setWaying(false);
            }}
            onRelay={(chosen, collects) => {
              setRelays((all) => ({
                ...all,
                [mail.key]: { ...chosen, collects },
              }));
              setWaying(false);
            }}
            onVoice={informed}
            onDismiss={() => setWaying(false)}
          />
        ) : choosing ? (
          <Sheet
            fixed
            title={t('notify.template.title')}
            className="pb-[calc(var(--safe-bottom)+16px)]"
            onDismiss={() => setChoosing(false)}
          >
            {templates.map((row, at) => (
              <Button
                key={row.id}
                variant={row.id === template.id ? 'primary' : 'secondary'}
                block
                className={at === 0 ? 'mt-6' : 'mt-3'}
                onClick={() => {
                  setTemplateId(row.id);
                  setChoosing(false);
                }}
              >
                {row.name}
              </Button>
            ))}
          </Sheet>
        ) : undefined
      }
    />
  );
}
