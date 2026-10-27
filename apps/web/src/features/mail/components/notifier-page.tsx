import {
  renderMail,
  type MailMessage,
  type MailTarget,
  type NotifyChange,
} from '@repo/contract/mail';
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
import { Dexie } from 'dexie';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useSession } from '#/features/auth/api/use-session';
import { db } from '#/features/db/database';
import { MailFallback } from '#/features/mail/components/mail-fallback';
import { needsFallback } from '#/features/mail/fallback';
import { useMailTarget } from '#/features/mail/mail-target';
import { MAILERS } from '#/features/mail/mailer';
import { drawPins } from '#/features/mail/pickup-code';
import {
  groupByRecipient,
  mailsAbout,
  recipientValues,
  type RecipientMail,
} from '#/features/mail/recipients';
import {
  listTemplates,
  type EmailTemplateView,
} from '#/features/mail/templates';
import { useNotifications } from '#/features/mail/use-notifications';
import { whenVisible } from '#/features/mail/visibility';
import { templateWarnings } from '#/features/mail/warnings';
import { loadRecipientContext } from '#/features/parcels/api/use-parcels';
import { initialsOf } from '#/features/settings/initials';
import { readPickup } from '#/features/settings/pickup';

const t = createTranslator(DEFAULT_LOCALE);

type Session = {
  mails: RecipientMail[];
  pins: string[];
  templates: EmailTemplateView[];
  pickup: PickupSetting;
  now: Date;
};

/**
 * The mails as they stood when the screen opened: a mail confirmed makes
 * its parcels "Notifié", and a live list would drop the page under the
 * agent's thumb.
 */
async function openSession(
  userId: string,
  parcelId: string | undefined,
): Promise<Session> {
  const now = new Date();
  const received = await db.parcel
    .where('[status+receivedAt]')
    .between(['recu', Dexie.minKey], ['recu', Dexie.maxKey])
    .toArray();
  const all = groupByRecipient(
    received,
    await loadRecipientContext(db, received),
  );
  const mails = parcelId ? mailsAbout(all, parcelId) : all;
  const [pins, templates, pickup] = await Promise.all([
    drawPins(db, mails.length, { now }),
    listTemplates(db, userId),
    readPickup(db),
  ]);
  return {
    mails,
    pins,
    templates: templates.filter((template) => template.type === 'avis'),
    pickup,
    now,
  };
}

type Sent = { state: NotifierMailState; count?: number };

/**
 * One mail per recipient of the "À notifier" parcels (F34), or of one
 * parcel's recipient when opened from its record. Each "Envoyer" opens the
 * mail app chosen in Réglages on a real link (S5); the agent then says
 * whether it left, and only a "yes" notifies the parcels (D2, declarative
 * follow-up). When the page stays in front, the fallback sheet offers the
 * other apps, the text to copy or share, and how it ended.
 */
export function NotifierPage({ parcelId }: { parcelId?: string }) {
  const navigate = useNavigate();
  const router = useRouter();
  const session = useSession();
  const userId = session.user.id;
  const outbox = useNotifications();
  const [opened, setOpened] = useState<Session | null>(null);
  const [index, setIndex] = useState(0);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
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

  useEffect(() => {
    let live = true;
    void openSession(userId, parcelId).then((value) => {
      if (live) setOpened(value);
    });
    return () => {
      live = false;
    };
  }, [userId, parcelId]);

  const back = () => {
    if (router.history.canGoBack()) router.history.back();
    else void navigate({ to: '/' });
  };

  if (!opened) return null;
  const { mails, pins, templates, pickup, now } = opened;
  const mail = mails[index];
  if (!mail) {
    return (
      <Screen tone="fill">
        <NavBar title={t('notify.title')} onBack={back} />
        <EmptyState
          icon="mail"
          title={t('notify.empty.title')}
          description={t('notify.empty.description')}
          className="mt-[129px]"
        />
      </Screen>
    );
  }

  const template =
    templates.find((row) => row.id === templateId) ??
    templates.find((row) => row.isDefault) ??
    templates[0]!;
  const code = pins[index] ?? null;
  const rendered = renderMail(
    template,
    recipientValues(mail, {
      pickup,
      agent: session.user.name,
      replyTo: session.user.email,
      code,
      now,
      t,
    }),
  );
  const message: MailMessage | undefined = mail.address
    ? { to: [mail.address], subject: rendered.subject, body: rendered.body }
    : undefined;
  const prepared = message && MAILERS[mailTarget].prepare(message);
  const sent = done[mail.key];
  const state: NotifierMailState = !mail.address
    ? 'missing'
    : (sent?.state ?? 'ready');
  const firstName = (mail.firstName ?? mail.name).split(/\s+/)[0] ?? '';
  const record = (to: '/colis/$parcelId' | '/colis/$parcelId/modifier') =>
    void navigate({ to, params: { parcelId: mail.parcels[0]!.id } });
  const last = index === mails.length - 1;

  const send = (event: MouseEvent) => {
    if (!prepared || !message || !mail.address || busy.current) {
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
      recipients: [mail.address],
      parcelIds: mail.parcels.map(({ id }) => id),
      templateId: template.stored ? template.id : null,
      target: mailTarget,
      pickupPin: code ?? undefined,
    });
    void (async () => {
      try {
        const row = await preparing;
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

  const confirmSent = (key: string, changes: NotifyChange[]) => {
    const count = changes.filter((change) => !('skip' in change)).length;
    setDone((all) => ({ ...all, [key]: { state: 'sent', count } }));
    if (index < mails.length - 1) setIndex(index + 1);
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
      }
      setAsking(null);
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
    }
  };

  const notice = failed
    ? { title: t('notify.error') }
    : state === 'missing'
      ? {
          title: t('notify.missing.title'),
          description: t('notify.missing.description'),
        }
      : state === 'sent'
        ? {
            title: t('notify.sent.title'),
            description: t(
              sent?.count === 1 ? 'notify.sent.one' : 'notify.sent.many',
              { count: sent?.count ?? 0 },
            ),
          }
        : state === 'failed'
          ? {
              title: t('notify.notSent.title'),
              description: t('notify.notSent.description'),
            }
          : undefined;

  return (
    <NotifierScreen
      position={index + 1}
      total={mails.length}
      recipient={{
        name: mail.name,
        initials: initialsOf(mail.name),
        email: mail.address ?? undefined,
        missing: mail.address ? undefined : t('notify.missing'),
        onClick: () => record('/colis/$parcelId'),
      }}
      state={state}
      template={{
        name: template.name,
        onClick: templates.length > 1 ? () => setChoosing(true) : undefined,
      }}
      preview={rendered}
      warnings={templateWarnings(rendered, t)}
      sendLabel={
        state === 'sent'
          ? t('notify.sent.title')
          : t('notify.send', { name: firstName })
      }
      sendHref={prepared?.url}
      onSend={send}
      completeLabel={t('notify.complete')}
      onComplete={() => record('/colis/$parcelId/modifier')}
      notice={notice}
      nextLabel={last ? t('notify.finish') : t('notify.next')}
      onNext={() => (last ? void navigate({ to: '/' }) : setIndex(index + 1))}
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
              setStayed(null);
            }}
          />
        ) : asking ? (
          <MailSentSheet
            recipient={
              mails.find((other) => other.key === asking.key)?.name ?? mail.name
            }
            onSent={() => void answer(true)}
            onNotSent={() => void answer(false)}
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
