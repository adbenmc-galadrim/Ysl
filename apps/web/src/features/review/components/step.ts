import type { VerifierColisScreenProps } from '@repo/ui';
import type { DraftParcel } from '#/features/db/schema';

/** What every field step of « Vérifier un colis » gets from the review. */
export type StepProps = Pick<
  VerifierColisScreenProps,
  'step' | 'photo' | 'onZoom' | 'onBack' | 'onSkip'
> & {
  draft: DraftParcel;
  /** « Valider et suivant », or « Valider » on the last field of the last parcel. */
  submitLabel: string;
};
