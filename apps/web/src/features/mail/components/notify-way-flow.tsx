import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { NotifyWaySheet, type ContactWay } from '@repo/ui';
import { useEffect, useRef, useState } from 'react';
import { useSession } from '#/features/auth/api/use-session';
import { db } from '#/features/db/database';
import { firstNameOf } from '#/features/handover/recipient';
import {
  cardOf,
  fixAddress,
  type AddressCard,
} from '#/features/mail/fix-address';
import {
  relayOf,
  rememberedRelay,
  type Relay,
} from '#/features/mail/notify-ways';
import type { RecipientMail } from '#/features/mail/recipients';
import { useAddressEntry } from '#/features/mail/use-address-entry';
import { RecipientChooser } from '#/features/recipient/components/recipient-chooser';
import { saveOutsideContact } from '#/features/recipient/contacts';
import type { Choice } from '#/features/recipient/options';

const t = createTranslator(DEFAULT_LOCALE);

export type NotifyWayFlowProps = {
  mail: RecipientMail;
  /** A reminder round: telling them dates a reminder. */
  reminder?: boolean;
  /** The address typed went on the card or the parcels: the page can send. */
  onAddress: (address: string) => void;
  /** The mail goes to this contact instead, prepared on the page. */
  onRelay: (relay: Relay, collects: boolean) => void;
  /** The agent told them: awaited, the sheet stays locked meanwhile. */
  onVoice: () => Promise<void>;
  onDismiss: () => void;
};

/**
 * « Comment le prévenir ? » (YSL-72, maquette 09 « Destinataire sans e-mail »)
 * for a recipient without an address: type it, write to a colleague or an
 * assistant instead (whoever was told last time offered first), or tell
 * them in person and give the code.
 */
export function NotifyWayFlow({
  mail,
  reminder,
  onAddress,
  onRelay,
  onVoice,
  onDismiss,
}: NotifyWayFlowProps) {
  const userId = useSession().user.id;
  const [way, setWay] = useState<ContactWay>('email');
  const [card, setCard] = useState<AddressCard | null>(null);
  const [remembered, setRemembered] = useState<Choice | null>(null);
  const [chosen, setChosen] = useState<Choice | null>(null);
  const [collects, setCollects] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [failed, setFailed] = useState(false);
  const entry = useAddressEntry(card, '');
  const busy = useRef(false);

  useEffect(() => {
    let live = true;
    void cardOf(db, mail).then((next) => {
      if (live) setCard(next);
    });
    void rememberedRelay(db, mail).then((choice) => {
      if (!live || !choice) return;
      setRemembered(choice);
      setChosen(choice);
      setWay('contact');
    });
    return () => {
      live = false;
    };
  }, [mail]);

  const run = async (step: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    setFailed(false);
    try {
      await step();
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
    }
  };

  const relay = chosen && relayOf(chosen);

  const confirm = () =>
    void run(async () => {
      if (way === 'email') {
        const { address, onCard } = entry;
        if (!card || !address) return;
        await fixAddress(
          db,
          {
            card,
            parcelIds: mail.parcels.map(({ id }) => id),
            address,
            onCard,
          },
          { agentId: userId },
        );
        onAddress(address);
      } else if (way === 'contact') {
        if (relay) onRelay(relay, collects);
      } else {
        await onVoice();
      }
    });

  if (choosing) {
    return (
      <RecipientChooser
        suggestions={remembered ? [remembered] : []}
        onPick={async (pick) => {
          const choice =
            pick.kind === 'card'
              ? pick.choice
              : await saveOutsideContact(db, pick, { agentId: userId });
          setChosen(choice);
          setChoosing(false);
        }}
        onClose={() => setChoosing(false)}
      />
    );
  }

  const fields = entry.fields(failed && way === 'email');
  return (
    <NotifyWaySheet
      fixed
      className="pb-[calc(var(--safe-bottom)+16px)]"
      recipient={mail.name}
      description={t('notify.way.description', { name: mail.name })}
      way={way}
      onWayChange={(next) => {
        setFailed(false);
        setWay(next);
      }}
      email={{
        value: fields.value,
        onValueChange: fields.onValueChange,
        valid: fields.valid,
        error: fields.error,
      }}
      relay={{
        name: chosen?.name,
        detail: relay ? relay.address : t('notify.way.relay.noEmail'),
        detailTone: relay ? 'muted' : 'red',
        chooseLabel: t('notify.way.relay.choose'),
        onChoose: () => setChoosing(true),
        collects,
        onCollectsChange: setCollects,
        collectsLabel: t('notify.way.relay.collects'),
      }}
      voiceNote={t(
        reminder ? 'notify.way.voice.note.reminder' : 'notify.way.voice.note',
      )}
      confirmLabel={
        way === 'email'
          ? t('mails.fix.save')
          : way === 'contact'
            ? relay
              ? t('notify.way.relay.prepare', {
                  name: firstNameOf(relay.name),
                })
              : t('notify.way.relay.choose')
            : t('notify.way.voice.confirm')
      }
      confirmDisabled={
        way === 'email'
          ? !entry.address
          : way === 'contact'
            ? !!chosen && !relay
            : false
      }
      onConfirm={
        way === 'contact' && !chosen ? () => setChoosing(true) : confirm
      }
      error={failed && way !== 'email' ? t('notify.error') : undefined}
      onDismiss={onDismiss}
    />
  );
}
