import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { PhotoViewer, RemiseConfirmeeScreen, SignatureScreen } from '@repo/ui';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { encodePhoto } from '#/features/camera/capture';
import { db } from '#/features/db/database';
import type { HandoverProofKind } from '#/features/db/schema';
import {
  confirmationGone,
  describeConfirmation,
  proofLabels,
} from '#/features/handover/confirmation';
import { loadHandoverEntry } from '#/features/handover/entry';
import { proofMediaItems, useProofUrls } from '#/features/handover/proof-urls';
import { addHandoverProof, type ProofInput } from '#/features/handover/proofs';
import { strokesToPng } from '#/features/handover/signature-png';
import { signatureHeading } from '#/features/handover/signing';
import { photoFiles } from '#/features/photos/opfs';
import { readImageFile } from '#/features/scan/read-file';
import { useOnline } from '#/lib/use-online';

const t = createTranslator(DEFAULT_LOCALE);

const PROOF_LABELS = proofLabels(t);

/** The photo of the handover as kept: upright, 1 600 px, JPEG without EXIF. */
async function photoProof(file: File): Promise<ProofInput> {
  const bitmap = await readImageFile(file);
  try {
    return { kind: 'photo', ...(await encodePhoto(bitmap)) };
  } finally {
    bitmap.close();
  }
}

export type RemiseConfirmeePageProps = {
  handoverId: string;
  /** The signature drawn before « Remettre » could not be kept: said at once. */
  signatureLost?: boolean;
  /** « Terminé », or the handover is not here to show: back to Colis. */
  onDone: () => void;
  onAnother: () => void;
};

/**
 * P4 step 4, once the handover is written on this iPhone: the agent shows it
 * to the recipient, and may still have them sign or photograph the parcels
 * handed over (D6, never required). The sync line follows the outbox live,
 * so « Envoyée au serveur » ticks itself while the screen is up. The file
 * input is rendered once, outside the signature's branch, so the camera
 * always hands its photo to a mounted input.
 */
export function RemiseConfirmeePage({
  handoverId,
  signatureLost = false,
  onDone,
  onAnother,
}: RemiseConfirmeePageProps) {
  const online = useOnline();
  const entry = useLiveQuery(
    () => loadHandoverEntry(db, handoverId),
    [handoverId],
  );
  const urls = useProofUrls(handoverId);
  const [draft, setDraft] = useState<string[] | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [failed, setFailed] = useState<HandoverProofKind | null>(
    signatureLost ? 'signature' : null,
  );
  const input = useRef<HTMLInputElement>(null);
  const missing = confirmationGone(entry);
  useEffect(() => {
    if (missing) onDone();
  }, [missing, onDone]);

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
        })
      : null;
  return (
    <>
      {!entry || !view ? null : draft ? (
        <SignatureScreen
          {...signatureHeading(entry.handover.recipientName, entry.parcels, t)}
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
          undoDisabled
          onAnother={onAnother}
          onDone={onDone}
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
