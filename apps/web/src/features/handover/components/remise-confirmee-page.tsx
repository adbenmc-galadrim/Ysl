import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { PhotoViewer, RemiseConfirmeeScreen, SignatureScreen } from '@repo/ui';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { db } from '#/features/db/database';
import type { HandoverProofKind } from '#/features/db/schema';
import {
  confirmationGone,
  describeConfirmation,
  proofLabels,
} from '#/features/handover/confirmation';
import { AnnulerRemiseSheet } from '#/features/handover/components/annuler-remise-sheet';
import { announceHandover } from '#/features/handover/done-toast';
import { loadHandoverEntry } from '#/features/handover/entry';
import { proofMediaItems, useProofUrls } from '#/features/handover/proof-urls';
import { photoProof } from '#/features/handover/photo-proof';
import { addHandoverProof, type ProofInput } from '#/features/handover/proofs';
import { strokesToPng } from '#/features/handover/signature-png';
import { signatureHeading } from '#/features/handover/signing';
import { photoFiles } from '#/features/photos/opfs';
import { readOperatingProfile } from '#/features/settings/operating-profile';
import { useOnline } from '#/lib/use-online';

const t = createTranslator(DEFAULT_LOCALE);

const PROOF_LABELS = proofLabels(t);

export type RemiseConfirmeePageProps = {
  handoverId: string;
  /** The signature drawn before « Remettre » could not be kept: said at once. */
  signatureLost?: boolean;
  /** « Terminé »: back to Colis. */
  onDone: () => void;
  /** The handover is not here to show, or was just cancelled. */
  onGone: () => void;
  onAnother: () => void;
  /** The next handover of a selection's queue, in place of « Remettre un autre ». */
  next?: { label: string; onClick: () => void };
};

/**
 * P4 step 4, once the handover is written on this iPhone: the agent shows it
 * to the recipient, and may still have them sign or photograph the parcels
 * handed over, as far as the profile offers it. The sync line follows the outbox live,
 * so « Envoyée au serveur » ticks itself while the screen is up. The file
 * input is rendered once, outside the signature's branch, so the camera
 * always hands its photo to a mounted input.
 */
export function RemiseConfirmeePage({
  handoverId,
  signatureLost = false,
  onDone,
  onGone,
  onAnother,
  next,
}: RemiseConfirmeePageProps) {
  const online = useOnline();
  const entry = useLiveQuery(
    () => loadHandoverEntry(db, handoverId),
    [handoverId],
  );
  const profile = useLiveQuery(() => readOperatingProfile(db), []);
  const urls = useProofUrls(handoverId);
  const [draft, setDraft] = useState<string[] | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [failed, setFailed] = useState<HandoverProofKind | null>(
    signatureLost ? 'signature' : null,
  );
  const input = useRef<HTMLInputElement>(null);
  const missing = confirmationGone(entry);
  const left = useRef(false);
  useEffect(() => {
    if (!missing || left.current) return;
    left.current = true;
    onGone();
  }, [missing, onGone]);

  const keep = async (proof: Promise<ProofInput>, kind: HandoverProofKind) => {
    setFailed(null);
    try {
      await addHandoverProof(db, photoFiles, handoverId, await proof);
    } catch (error) {
      console.warn('Handover proof not kept', error);
      setFailed(kind);
    }
  };

  const photoInput = (
    <input
      ref={input}
      type="file"
      accept="image/*"
      capture="environment"
      hidden
      onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (file) void keep(photoProof(file), 'photo');
      }}
    />
  );

  const view =
    entry && !missing
      ? describeConfirmation(entry, online, t, {
          onSign: () => setDraft([]),
          onPhoto: () => input.current?.click(),
          failed,
          noSignature: profile?.signature === 'disabled',
          noPhoto: profile?.photo === 'disabled',
        })
      : null;
  return (
    <>
      {!entry || !view ? null : draft ? (
        <SignatureScreen
          {...signatureHeading(
            entry.handover.recipientName,
            entry.parcels,
            t,
            entry.handover.delegateName,
          )}
          strokes={draft}
          onChange={setDraft}
          onClear={() => setDraft([])}
          onClose={() => setDraft(null)}
          onConfirm={() => {
            const strokes = draft;
            setDraft(null);
            void keep(
              strokesToPng(strokes).then((image) => ({
                kind: 'signature' as const,
                ...image,
              })),
              'signature',
            );
          }}
        />
      ) : (
        <RemiseConfirmeeScreen
          {...view}
          media={{
            items: proofMediaItems(urls, PROOF_LABELS, setViewing),
          }}
          undoLabel={t('handover.done.undo')}
          onUndo={() => setCancelling(true)}
          onAnother={onAnother}
          next={next}
          onDone={onDone}
        />
      )}
      {cancelling && !draft && (
        <AnnulerRemiseSheet
          handoverId={handoverId}
          onClose={() => setCancelling(false)}
          onCancelled={(count) =>
            announceHandover({ kind: 'cancelled', count })
          }
        />
      )}
      {photoInput}
      {viewing && !draft && (
        <PhotoViewer
          src={viewing}
          alt={PROOF_LABELS.photo}
          closeLabel={t('record.photo.close')}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  );
}
