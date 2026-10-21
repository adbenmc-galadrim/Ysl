import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { CheckList, type CheckListItem } from '#components/check-list';
import { ResultHero } from '#components/result-hero';
import { Screen } from '#components/screen';
import { Toast } from '#components/toast';

export type RemiseConfirmeeScreenProps = {
  /** "3 colis remis". */
  title: string;
  /** "à Nora Haddad, à 11 h 21". */
  description: string;
  proofs: CheckListItem[];
  /** Shows the undo toast while the handover can still be cancelled. */
  undoable?: boolean;
  onUndo?: () => void;
  onDone?: () => void;
};

/**
 * The end of a handover. The proofs are listed so the agent can tell the
 * recipient it is all recorded; the undo stays a toast — a mistake caught
 * at the desk is fixed in one tap, without a menu.
 */
export function RemiseConfirmeeScreen({
  title,
  description,
  proofs,
  undoable = true,
  onUndo,
  onDone,
}: RemiseConfirmeeScreenProps) {
  return (
    <Screen
      bottomInset={180}
      bottom={
        <BottomBar surface="none" className="flex-col gap-7">
          {undoable && (
            <Toast
              message="Remise enregistrée"
              actionLabel="Annuler"
              onAction={onUndo}
            />
          )}
          <Button block onClick={onDone}>
            Terminé
          </Button>
        </BottomBar>
      }
    >
      {/* 162 px down on the mockup's phone; on a shorter one the hero rises
          so the proofs stay clear of the toast. */}
      <ResultHero
        title={title}
        description={description}
        className="mt-[clamp(24px,calc(100dvh-690px),162px)]"
      />
      <CheckList items={proofs} className="mt-[34px]" />
    </Screen>
  );
}
