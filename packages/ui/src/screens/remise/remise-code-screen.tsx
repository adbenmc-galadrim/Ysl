import { CodeInput } from '#components/code-input';
import { Keypad } from '#components/keypad';
import { NavBar } from '#components/nav-bar';
import { Screen } from '#components/screen';

export type RemiseCodeScreenProps = {
  /** Digits typed so far. */
  code: string;
  length?: number;
  onDigit?: (digit: string) => void;
  onDelete?: () => void;
};

/**
 * Handover by code, when the recipient has no QR at hand. The parcel opens
 * on the last digit, so there is no "Valider" button to reach for.
 */
export function RemiseCodeScreen({
  code,
  length = 4,
  onDigit,
  onDelete,
}: RemiseCodeScreenProps) {
  return (
    <Screen
      bottom={
        <Keypad
          onDigit={onDigit}
          onDelete={onDelete}
          className="px-5 pb-[calc(var(--safe-bottom)+58px)]"
        />
      }
    >
      <NavBar title="Code de retrait" />
      <p className="mt-8 text-center text-16 text-muted">
        Code à {length} chiffres reçu par e-mail
      </p>
      <CodeInput value={code} length={length} className="mt-[25px]" />
      <p className="mt-[26px] text-center text-14 text-muted">
        Le colis s’affichera dès le dernier chiffre.
      </p>
    </Screen>
  );
}
