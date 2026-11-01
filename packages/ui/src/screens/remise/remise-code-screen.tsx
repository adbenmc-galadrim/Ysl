import { Button } from '#components/button';
import { CodeInput } from '#components/code-input';
import { Keypad } from '#components/keypad';
import { NavBar } from '#components/nav-bar';
import { PhoneBanner } from '#components/phone-parts';
import { Screen } from '#components/screen';

export type RemiseCodeScreenProps = {
  /** Digits typed so far. */
  code: string;
  length?: number;
  /** Why the last code opened nothing; the boxes turn red until the next digit. */
  error?: string;
  /** Keeps the boxes red over a code still shown. */
  invalid?: boolean;
  /** The code opens at another counter: which one, and that nothing was handed over. */
  elsewhere?: { title: string; description: string };
  /**
   * Too many wrong codes in a row: the pad is inert and this says how long
   * to wait (« Réessayez dans 30 s »).
   */
  locked?: string;
  onDigit?: (digit: string) => void;
  onDelete?: () => void;
  onBack?: () => void;
  /** Shown under a refusal: the way round a code that opens nothing. */
  onSearchName?: () => void;
};

/**
 * Handover by code, when the recipient has no QR at hand. The parcel opens
 * on the last digit, so there is no "Valider" button to reach for.
 */
export function RemiseCodeScreen({
  code,
  length = 4,
  error,
  invalid = false,
  elsewhere,
  locked,
  onDigit,
  onDelete,
  onBack,
  onSearchName,
}: RemiseCodeScreenProps) {
  const alert = locked ?? error;
  return (
    <Screen
      bottom={
        <Keypad
          disabled={locked !== undefined}
          onDigit={onDigit}
          onDelete={onDelete}
          keyClassName="h-14 rounded-[12px] text-26"
          className="px-5 pb-[calc(var(--safe-bottom)+100px)]"
        />
      }
    >
      <NavBar title="Code de retrait" onBack={onBack} />
      <p className="mt-5 text-center text-15 text-muted">
        Code à {length} chiffres reçu par e-mail
      </p>
      <CodeInput
        value={code}
        length={length}
        invalid={
          invalid || ((error !== undefined || elsewhere !== undefined) && !code)
        }
        focused={locked === undefined}
        boxClassName="h-16 w-[55px] rounded-[12px] border-[1.5px] font-sans text-28 text-ink"
        className="mt-[18px] gap-2"
      />
      {elsewhere && locked === undefined ? (
        <PhoneBanner
          tone="red"
          icon="alert"
          title={elsewhere.title}
          description={elsewhere.description}
          height={83}
          className="mt-6"
        />
      ) : alert ? (
        <>
          <p role="alert" className="mt-[26px] text-center text-14 text-red">
            {alert}
          </p>
          {onSearchName && (
            <Button
              variant="link"
              icon="search"
              onClick={onSearchName}
              className="mt-3 self-center text-16 font-semibold"
            >
              Chercher un nom
            </Button>
          )}
        </>
      ) : (
        <p className="mt-[26px] text-center text-14 text-muted">
          Le colis s’affichera dès le dernier chiffre.
        </p>
      )}
    </Screen>
  );
}
