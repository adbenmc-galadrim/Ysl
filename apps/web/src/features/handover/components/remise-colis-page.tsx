import {
  type HandoverStep,
  missingHandoverSteps,
} from '@repo/contract/operating-profile';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  QuiRetireScreen,
  RemiseColisScreen,
  RetireParScreen,
  SignatureScreen,
} from '@repo/ui';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { db } from '#/features/db/database';
import {
  announcedCollector,
  type CollectorCard,
  choiceCard,
  collectorCard,
  collectorChoices,
  collectorName,
  sameName,
} from '#/features/handover/collector';
import { RemiseVerifierColis } from '#/features/handover/components/remise-verifier-colis';
import { lowerFirst } from '#/features/handover/journal';
import { hasLabel, scanComplete } from '#/features/handover/parcel-scan';
import { photoProof } from '#/features/handover/photo-proof';
import type { PickupRefusal } from '#/features/handover/pickup-lookup';
import {
  type HandoverDone,
  HandoverRefusedError,
  recordHandover,
} from '#/features/handover/record-handover';
import { loadHandoverPerson } from '#/features/handover/recipient';
import { strokesToPng } from '#/features/handover/signature-png';
import { signedMethod } from '#/features/handover/proofs';
import { signatureHeading } from '#/features/handover/signing';
import {
  type RemiseColisSearch,
  untickedAtFirst,
} from '#/features/handover/route';
import {
  listWaitingParcels,
  toRemiseParcel,
} from '#/features/handover/waiting';
import { useMinuteClock } from '#/features/parcels/api/use-parcels';
import { formatTime } from '#/features/parcels/model';
import { loadRecipientBook } from '#/features/parcels/recipients';
import { formatWhen } from '#/features/parcels/record';
import { photoFiles } from '#/features/photos/opfs';
import { initialsOf } from '#/features/settings/initials';
import { readOperatingProfile } from '#/features/settings/operating-profile';

const t = createTranslator(DEFAULT_LOCALE);

export type RemiseColisPageProps = {
  search: RemiseColisSearch;
  agentId: string;
  agentName: string;
  onBack: () => void;
  /** The card or contact is no longer on this iPhone. */
  onGone: () => void;
  /** The QR or the code no longer opens: back to the viewfinder, saying why. */
  onRefused: (reason: PickupRefusal) => void;
  onDone: (done: HandoverDone) => void;
};

/**
 * P4 steps 2 and 4: the person is known, their parcels are listed, all
 * ticked; the agent unticks what stays on the shelf and hands the rest
 * over. The QR or the code is checked again as it is written.
 */
export function RemiseColisPage({
  search,
  agentId,
  agentName,
  onBack,
  onGone,
  onRefused,
  onDone,
}: RemiseColisPageProps) {
  const now = useMinuteClock();
  const { kind, id, via, at } = search;
  // Opened from a selection, the parcels not ticked on Colis start unticked.
  const [unticked, setUnticked] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  /** The strokes on the pad while it is open, and those validated. */
  const [draft, setDraft] = useState<string[] | null>(null);
  const [signed, setSigned] = useState<string[]>([]);
  /** Who collects when not the recipient, and the step of choosing them. */
  const [collector, setCollector] = useState<CollectorCard | null>(null);
  const [choosing, setChoosing] = useState<'choice' | 'search' | null>(null);
  const [choice, setChoice] = useState<'collector' | 'recipient'>('collector');
  const [query, setQuery] = useState('');
  /** A choice was made on this screen: the announcement no longer decides. */
  const [touched, setTouched] = useState(false);
  /** The labels read at the counter, and the viewfinder that reads them. */
  const [scanned, setScanned] = useState<ReadonlySet<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  /** The photo a profile requires before the handover. */
  const [photo, setPhoto] = useState<File | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  /** A signature or a photo the profile requires could not be kept. */
  const [lost, setLost] = useState(false);
  const book = useLiveQuery(() => loadRecipientBook(db), []);
  const loaded = useLiveQuery(async () => {
    const [person, parcels, profile] = await Promise.all([
      loadHandoverPerson(db, { kind, id }),
      listWaitingParcels(db, { kind, id }),
      readOperatingProfile(db),
    ]);
    return { person, parcels, profile };
  }, [kind, id]);

  const gone = loaded !== undefined && loaded.person === null;
  useEffect(() => {
    if (gone) onGone();
  }, [gone, onGone]);

  if (!loaded?.person) return null;
  const { person, parcels, profile } = loaded;
  const excluded =
    unticked ??
    untickedAtFirst(
      parcels.map((parcel) => parcel.id),
      search.colis,
    );
  const ticked = parcels
    .map((parcel) => parcel.id)
    .filter((parcelId) => !excluded.includes(parcelId));
  const time = formatTime(new Date(at));
  const leaving = parcels.filter((parcel) => ticked.includes(parcel.id));
  const scanOffered = profile.handoverScan !== 'disabled';
  const hasScan = scanOffered && scanComplete(leaving, scanned);
  const missing = missingHandoverSteps(profile, {
    method: signed.length > 0 ? signedMethod(via) : via,
    hasSignature: signed.length > 0,
    hasPhoto: photo !== null,
    hasScan,
  });
  const noteOf = (step: HandoverStep) => {
    switch (step) {
      case 'proof':
        return profile.signature === 'disabled'
          ? t('handover.step.proof.only')
          : t('handover.step.proof');
      case 'signature':
        return t('handover.step.signature');
      case 'photo':
        return t('handover.step.photo');
      case 'scan':
        return t('handover.step.scan');
    }
  };
  const confirmNote = lost
    ? t('handover.step.lost')
    : missing[0] && noteOf(missing[0]);
  const labelled = leaving.filter(hasLabel);
  const readCount = labelled.filter((parcel) => scanned.has(parcel.id)).length;
  const scanLabel =
    labelled.length > 0 && readCount === labelled.length
      ? t('handover.scan.done')
      : readCount === 0 && profile.handoverScan === 'optional'
        ? t('handover.scan.offer')
        : t('handover.scan.progress', {
            read: readCount,
            count: labelled.length,
          });

  const toggle = (parcelId: string) =>
    setUnticked(
      excluded.includes(parcelId)
        ? excluded.filter((other) => other !== parcelId)
        : [...excluded, parcelId],
    );
  const toggleAll = () =>
    setUnticked(
      ticked.length === parcels.length ? parcels.map((p) => p.id) : [],
    );
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const signature =
        signed.length > 0
          ? await strokesToPng(signed).then(
              (image) => ({
                proof: { kind: 'signature' as const, ...image },
                files: photoFiles,
              }),
              (error: unknown) => {
                console.warn('Signature not drawn', error);
                return null;
              },
            )
          : undefined;
      const picture = photo
        ? await photoProof(photo).then(
            (proof) => ({ proof, files: photoFiles }),
            (error: unknown) => {
              console.warn('Photo not encoded', error);
              return undefined;
            },
          )
        : undefined;
      const done = await recordHandover(
        db,
        {
          ...search,
          parcelIds: ticked,
          delegateName: collector?.name,
          hasScan,
        },
        {
          agentId,
          agentName,
          signature: signature ?? undefined,
          photo: picture,
        },
      );
      onDone(signature === null ? { ...done, signatureLost: true } : done);
    } catch (error) {
      setBusy(false);
      if (!(error instanceof HandoverRefusedError)) throw error;
      switch (error.reason) {
        case 'gone':
          return onGone();
        case 'missing':
        case 'mismatch':
          return onRefused('unknown');
        case 'stale':
        case 'nothing':
          return;
        case 'steps':
          setSigned([]);
          setPhoto(null);
          setLost(true);
          return;
        default:
          return onRefused(error.reason);
      }
    }
  };

  const announced = announcedCollector(parcels);
  const people = book?.people ?? [];
  const contacts = book?.contacts ?? [];
  const candidate =
    collector ??
    (announced
      ? collectorCard(announced.name, people, contacts, book?.names)
      : null);
  const pick = (card: CollectorCard) => {
    const next = collectorName(card.name, person.name) ? card : null;
    // A signature drawn by someone else no longer stands for who collects.
    if (next?.name !== collector?.name) setSigned([]);
    setCollector(next);
    setTouched(true);
    setChoosing(null);
    setQuery('');
  };
  const openCollector = () => {
    // Opened again after « elle-même », the choice made stays ticked.
    setChoice(collector || !touched ? 'collector' : 'recipient');
    setChoosing(candidate ? 'choice' : 'search');
  };

  const collectorNote =
    via !== 'manuel'
      ? t('handover.collector.proofNote', { name: person.name })
      : profile.signature === 'disabled'
        ? t('handover.collector.nameNote')
        : profile.signature === 'required'
          ? t('handover.collector.mustSign')
          : t('handover.collector.signNote');

  if (scanning) {
    return (
      <RemiseVerifierColis
        parcels={parcels}
        progress={scanLabel}
        onRead={(parcelId) => setScanned((read) => new Set(read).add(parcelId))}
        onClose={() => setScanning(false)}
      />
    );
  }

  if (choosing === 'search') {
    const { choices, listed } = collectorChoices(
      people,
      contacts,
      query,
      book?.names,
    );
    const typed = collectorName(query, '');
    return (
      <QuiRetireScreen
        title={t('handover.collector.title', { name: person.name })}
        navTitle={t('handover.collector.nav')}
        query={query}
        onQueryChange={setQuery}
        waiting={[]}
        others={listed}
        othersTitle={t('handover.collector.results')}
        onPickOther={(row) => {
          const found = choices[listed.indexOf(row)];
          if (found) pick(choiceCard(found));
        }}
        typed={typed ?? undefined}
        onUseTyped={() =>
          typed && pick({ name: typed, initials: initialsOf(typed) })
        }
        note={collectorNote}
        onClose={() => setChoosing(candidate ? 'choice' : null)}
      />
    );
  }

  if (choosing === 'choice' && candidate) {
    return (
      <RetireParScreen
        recipient={person}
        collector={candidate}
        announcement={
          announced?.at && sameName(candidate.name, announced.name)
            ? t('handover.collector.announcement', {
                when: lowerFirst(formatWhen(announced.at, now, t)),
              })
            : undefined
        }
        recipientOption={t('handover.collector.self')}
        selected={choice}
        onSelect={setChoice}
        note={collectorNote}
        continueLabel={t('handover.collector.continue')}
        onOtherPerson={() => setChoosing('search')}
        onContinue={() => pick(choice === 'collector' ? candidate : person)}
        onBack={() => setChoosing(null)}
      />
    );
  }

  if (draft) {
    return (
      <SignatureScreen
        {...signatureHeading(
          person.name,
          parcels.filter((parcel) => ticked.includes(parcel.id)),
          t,
          collector?.name,
        )}
        strokes={draft}
        onChange={setDraft}
        onClear={() => setDraft([])}
        onClose={() => setDraft(null)}
        onConfirm={() => {
          setSigned(draft);
          setDraft(null);
          setLost(false);
        }}
      />
    );
  }

  const signatureOffered = profile.signature !== 'disabled';
  return (
    <>
      <RemiseColisScreen
        recipient={person}
        verified={
          via === 'qr'
            ? t('handover.verified.qr', { time })
            : via === 'pin'
              ? t('handover.verified.pin', { time })
              : t('handover.verified.manuel')
        }
        verifiedBy={via === 'manuel' ? 'name' : 'proof'}
        collector={collector?.name}
        announced={
          announced
            ? t('handover.collector.announced', { name: announced.name })
            : undefined
        }
        onCollector={openCollector}
        signed={signed.length > 0}
        registeredNote={
          profile.signature === 'optional'
            ? t('handover.registered')
            : profile.signature === 'required'
              ? t('handover.registered.required')
              : t('handover.registered.none')
        }
        signatureRequired={profile.signature === 'required'}
        onSignature={signatureOffered ? () => setDraft(signed) : undefined}
        photo={
          profile.photo === 'required'
            ? {
                taken: photo !== null,
                onTake: () => photoInput.current?.click(),
              }
            : undefined
        }
        scan={
          scanOffered && labelled.length > 0
            ? {
                label: scanLabel,
                done: readCount === labelled.length,
                onScan: () => setScanning(true),
              }
            : undefined
        }
        confirmNote={confirmNote}
        parcels={parcels.map((parcel) => toRemiseParcel(parcel, now, t))}
        excluded={excluded}
        empty={t('handover.empty', { name: person.firstName })}
        busy={busy}
        onToggle={toggle}
        onToggleAll={toggleAll}
        onConfirm={() => void confirm()}
        onBack={onBack}
      />
      {profile.photo === 'required' && (
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file) {
              setPhoto(file);
              setLost(false);
            }
          }}
        />
      )}
    </>
  );
}
