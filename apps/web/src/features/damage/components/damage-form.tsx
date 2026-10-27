import {
  DAMAGE_LABEL,
  DAMAGE_REASONS,
  type DamageReason,
} from '@repo/contract/parcel-damage';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { ColisAbimeScreen, PhotoViewer } from '@repo/ui';
import { useEffect, useRef, useState } from 'react';
import type { DraftPhoto } from '#/features/batch/store';
import { encodePhoto } from '#/features/camera/capture';
import type { DamageInput } from '#/features/damage/report';
import { readImageFile } from '#/features/scan/read-file';

const t = createTranslator(DEFAULT_LOCALE);

const LABELS = DAMAGE_REASONS.map((reason) => DAMAGE_LABEL[reason]);

function reasonOf(label: string): DamageReason | undefined {
  return DAMAGE_REASONS.find((reason) => DAMAGE_LABEL[reason] === label);
}

type TakenPhoto = DraftPhoto & { url: string };

/** A photo of the damage as kept: upright, 1 600 px on the long side, JPEG. */
async function takePhoto(file: File): Promise<TakenPhoto> {
  const bitmap = await readImageFile(file);
  try {
    const photo = await encodePhoto(bitmap);
    return { ...photo, url: URL.createObjectURL(photo.blob) };
  } finally {
    bitmap.close();
  }
}

export type DamageFormProps = {
  /** Who and which parcel, as the header line says it. */
  parcel: { recipient: string; carrier: string; last4: string };
  onClose: () => void;
  /** Writes the reserve; a rejection keeps the form open with an error. */
  onSave: (input: DamageInput, photos: DraftPhoto[]) => Promise<void>;
};

/**
 * « Signaler un dommage » (zone d'ombre « Colis abîmé »): a reason, photos
 * from the camera or the library, a remark, and who should hear about it.
 * The photos wait in memory until the save, which writes them with the
 * reserve. The file input is rendered once, outside any branch, so the
 * chooser always hands its files to a mounted input.
 */
export function DamageForm({ parcel, onClose, onSave }: DamageFormProps) {
  const [reason, setReason] = useState<DamageReason>();
  const [note, setNote] = useState('');
  const [notifyRecipient, setNotifyRecipient] = useState(true);
  const [carrierReserve, setCarrierReserve] = useState(false);
  const [photos, setPhotos] = useState<TakenPhoto[]>([]);
  const [viewing, setViewing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]);

  useEffect(
    () => () => {
      for (const url of urls.current) URL.revokeObjectURL(url);
    },
    [],
  );

  const onFiles = async (files: File[]) => {
    setError(undefined);
    for (const file of files) {
      try {
        const photo = await takePhoto(file);
        urls.current.push(photo.url);
        setPhotos((taken) => [...taken, photo]);
      } catch {
        setError(t('damage.error.photo'));
      }
    }
  };

  const save = async () => {
    if (!reason || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await onSave(
        { reason, note, notifyRecipient, carrierReserve },
        photos.map(({ blob, width, height }) => ({ blob, width, height })),
      );
    } catch {
      setError(t('record.error.write'));
      setBusy(false);
    }
  };

  return (
    <>
      <ColisAbimeScreen
        parcel={parcel}
        reasons={LABELS}
        reason={reason && DAMAGE_LABEL[reason]}
        onReasonChange={(label) => setReason(reasonOf(label))}
        photos={photos.map((photo, index) => (
          <button
            key={photo.url}
            type="button"
            aria-label={t('record.photo.zoom', {
              alt: t('record.damage.photo.alt', { n: index + 1 }),
            })}
            onClick={() => setViewing(photo.url)}
            className="size-[104px] cursor-zoom-in overflow-hidden rounded-control bg-fill"
          >
            <img
              src={photo.url}
              alt=""
              draggable={false}
              className="size-full object-cover"
            />
          </button>
        ))}
        onAddPhoto={() => input.current?.click()}
        remark={note}
        onRemarkChange={setNote}
        notifyRecipient={notifyRecipient}
        onNotifyRecipientChange={setNotifyRecipient}
        carrierReserve={carrierReserve}
        onCarrierReserveChange={setCarrierReserve}
        error={error}
        busy={busy}
        onClose={onClose}
        onSave={() => void save()}
        overlay={
          viewing && (
            <PhotoViewer
              src={viewing}
              alt={t('record.damage.photo.alt', {
                n: photos.findIndex((photo) => photo.url === viewing) + 1,
              })}
              closeLabel={t('record.photo.close')}
              onClose={() => setViewing(null)}
            />
          )
        }
      />
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          void onFiles(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = '';
        }}
      />
    </>
  );
}
