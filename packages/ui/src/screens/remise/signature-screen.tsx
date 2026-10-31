import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { IconButton } from '#components/icon-button';
import { NavBar, NavBarAction } from '#components/nav-bar';
import { Screen } from '#components/screen';
import { SignaturePad } from '#components/signature-pad';

export type SignatureScreenProps = {
  /** "Nora Haddad signe pour 3 colis". */
  title: string;
  /** What makes the signature necessary: a registered parcel, a colleague. */
  detail?: string;
  strokes?: string[];
  onChange?: (strokes: string[]) => void;
  onClose?: () => void;
  onClear?: () => void;
  onConfirm?: () => void;
};

/**
 * The signature, as far as the profile asks: before the handover when the
 * recipient was picked by the name or the profile requires it, and after any
 * handover from its confirmation. The pad takes the whole middle of the screen: the phone is
 * handed over the desk and signed upright, with whatever finger is free.
 */
export function SignatureScreen({
  title,
  detail,
  strokes,
  onChange,
  onClose,
  onClear,
  onConfirm,
}: SignatureScreenProps) {
  const empty = strokes !== undefined && strokes.length === 0;
  return (
    <Screen
      bottom={
        <BottomBar surface="plain">
          <Button block disabled={empty} onClick={onConfirm}>
            Valider la signature
          </Button>
        </BottomBar>
      }
    >
      <NavBar
        title="Signature"
        leading={
          // The flow is modal: a cross, and no `pl-0.5` nudge since this is
          // the 44 px square itself rather than a text action.
          <IconButton
            icon="x"
            label="Fermer"
            size="lg"
            iconSize={22}
            onClick={onClose}
            className="-ml-0.5"
          />
        }
        trailing={<NavBarAction onClick={onClear}>Effacer</NavBarAction>}
      />
      <h2 className="mt-4 text-22 font-bold">{title}</h2>
      {detail && <p className="mt-1.5 text-15 text-muted">{detail}</p>}
      <SignaturePad
        strokes={strokes}
        onChange={onChange}
        // 420 px on the mockup's 852 px phone; it gives way on shorter ones
        // so the hint under it stays above the button.
        className="mt-[30px] h-[clamp(240px,calc(100dvh-432px),420px)]"
      />
      <p className="mt-6 text-center text-14 text-muted">
        Tournez l’iPhone pour plus de place
      </p>
    </Screen>
  );
}
