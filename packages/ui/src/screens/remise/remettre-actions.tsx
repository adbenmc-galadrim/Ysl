import { Button } from '#components/button';
import { IconButton } from '#components/icon-button';
import { Icon } from '#icons';

export type RemettreActionsProps = {
  onSearch?: () => void;
  onHandover?: () => void;
  onScan?: () => void;
  /** The account receives nothing: no « Scanner », « Remettre » is the primary. */
  handoverOnly?: boolean;
};

/**
 * The home bottom bar with a "Remettre" shortcut next to "Scanner": search
 * shrinks to a square so the handover, the other half of the desk's day,
 * gets its own button in the thumb zone. Pass it as `ColisScreen`'s
 * `actions`.
 */
export function RemettreActions({
  onSearch,
  onHandover,
  onScan,
  handoverOnly = false,
}: RemettreActionsProps) {
  return (
    <>
      <IconButton
        icon="search"
        label="Rechercher"
        iconSize={22}
        onClick={onSearch}
        className="size-[52px]"
      />
      {/* 16 px label and 20 px icon: a notch under Scanner when it is there. */}
      <Button
        variant={handoverOnly ? undefined : 'secondary'}
        onClick={onHandover}
        className="min-w-0 flex-1 gap-2 px-0 text-16"
      >
        <Icon name="qr" size={20} />
        Remettre
      </Button>
      {!handoverOnly && (
        <Button icon="scan" onClick={onScan} className="w-[141px]">
          Scanner
        </Button>
      )}
    </>
  );
}
