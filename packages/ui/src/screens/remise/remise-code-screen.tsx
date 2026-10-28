import { CodeInput } from '#components/code-input';
import { Keypad } from '#components/keypad';
import { NavBar } from '#components/nav-bar';
import { Screen } from '#components/screen';

export type RemiseCodeScreenProps = {
  /** Digits typed so far. */
  code: string;
  length?: number;
  /** Why the last code opened nothing; the boxes turn red until the next digit. */
  error?: string;
  /**
   * Too many wrong codes in a row: the pad is inert and this says how long
   * to wait (« Réessayez dans 30 s »).
   */
  locked?: string;
  onDigit?: (digit: string) => void;
  onDelete?: () => void;
  onBack?: () => void;
};

/**
 * Handover by code, when the recipient has no QR at hand. The parcel opens
 * on the last digit, so there is no "Valider" button to reach for.
 */
export function RemiseCodeScreen({
  code,
  length = 4,
  error,
  locked,
  onDigit,
  onDelete,
  onBack,
}: RemiseCodeScreenProps) {
  const alert = locked ?? error;
  return (
    <Screen
      bottom={
        <Keypad
          disabled={locked !== undefined}
          onDigit={onDigit}
          onDelete={onDelete}
          className="px-5 pb-[calc(var(--safe-bottom)+58px)]"
        />
      }
    >
      <NavBar title="Code de retrait" onBack={onBack} />
      <p className="mt-8 text-center text-16 text-muted">
        Code à {length} chiffres reçu par e-mail
      </p>
      <CodeInput
        value={code}
        length={length}
        invalid={error !== undefined && !code}
        focused={locked === undefined}
        className="mt-[25px]"
      />
      {alert ? (
        <p role="alert" className="mt-[26px] text-center text-14 text-red">
          {alert}
        </p>
      ) : (
        <p className="mt-[26px] text-center text-14 text-muted">
          Le colis s’affichera dès le dernier chiffre.
        </p>
      )}
    </Screen>
  );
}
