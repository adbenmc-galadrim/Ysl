import type { ReactNode } from 'react';

import { Button } from '#components/button';
import { Sheet } from '#components/sheet';

export type ReprendreLotScreenProps<T extends { id: string }> = {
  /** The home list the app reopened on, dimmed under the sheet. */
  behind?: ReactNode;
  /** Over the app's own screen rather than around `behind`, see `Sheet`. */
  fixed?: boolean;
  /** When the interrupted batch started, with its preposition: "de 10 h 31", "d’hier à 10 h 31". */
  startedAt: string;
  /** Parcels scanned in it but not saved yet. */
  parcels: T[];
  /** One thumbnail per parcel, e.g. the photo of its label. */
  thumbnail: (parcel: T, index: number) => ReactNode;
  onResume?: () => void;
  onReview?: () => void;
  onDiscard?: () => void;
};

/** Thumbnails drawn before the "+N" tile; six columns fill the sheet. */
export const RESUME_THUMBNAILS = 5;

/**
 * The app was killed mid-batch (a call, a crash, a dead battery). Scans are
 * kept on the phone as they happen, so reopening offers the batch back
 * instead of losing it — and shows the labels, because "7 colis" alone does
 * not tell the agent which pile they were working on.
 */
export function ReprendreLotScreen<T extends { id: string }>({
  behind,
  fixed,
  startedAt,
  parcels,
  thumbnail,
  onResume,
  onReview,
  onDiscard,
}: ReprendreLotScreenProps<T>) {
  const count = parcels.length;
  const hidden = count - RESUME_THUMBNAILS;
  return (
    <Sheet
      behind={behind}
      fixed={fixed}
      title="Reprendre le lot ?"
      description={`L’app s’est fermée pendant le lot ${startedAt}. Rien n’est perdu.`}
      descriptionClassName="mt-3 leading-[21px]"
      className="pb-[calc(var(--safe-bottom)+27px)]"
    >
      <ul className="mt-2.5 grid grid-cols-6 gap-2">
        {parcels
          .slice(0, hidden > 0 ? RESUME_THUMBNAILS : count)
          .map((parcel, i) => (
            <li key={parcel.id} className="flex">
              {thumbnail(parcel, i)}
            </li>
          ))}
        {hidden > 0 && (
          <li className="flex aspect-[52/64] items-center justify-center rounded-[8px] bg-fill text-16 font-semibold">
            +{hidden}
          </li>
        )}
      </ul>
      <p className="mt-3.5 text-15 font-semibold">
        {count} colis scannés, pas encore enregistrés
      </p>
      <Button block className="mt-[22px]" onClick={onResume}>
        Reprendre le scan
      </Button>
      <Button variant="secondary" block className="mt-3" onClick={onReview}>
        Vérifier et enregistrer
      </Button>
      <Button
        variant="link"
        className="mt-5 self-center text-16 font-semibold text-red"
        onClick={onDiscard}
      >
        Abandonner ces {count} colis
      </Button>
    </Sheet>
  );
}
