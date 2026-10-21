import type { ComponentProps, ReactNode } from 'react';

import { IconButton } from '#components/icon-button';
import { cn } from '#lib/tv';

export type NavBarProps = {
  /**
   * Centred in the bar, iOS style. The settings screens carry their title
   * here instead of a large title in the body: the client asked for it, so a
   * grouped list starts right under the bar.
   */
  title?: ReactNode;
  /** Shows the back square; `false` for a root screen. */
  back?: boolean;
  onBack?: () => void;
  backLabel?: string;
  /**
   * Left side in place of the back square, e.g. a `NavBarAction` "Annuler"
   * on a modal form or "Tout sélectionner" in selection mode.
   */
  leading?: ReactNode;
  /** Right side: a `NavBarAction` ("OK", "Importer") or an `IconButton`. */
  trailing?: ReactNode;
  className?: string;
};

/**
 * The navigation bar of a pushed screen: a 44 px back square, the title,
 * and at most one action. The three columns are a grid with equal sides so
 * the title stays centred on the screen whatever the action's width.
 *
 * It bleeds 2 px into the gutter because the mockups draw the 44 px square
 * around a 40 px column: the icon lines up with the content, not the square.
 */
export function NavBar({
  title,
  back = true,
  onBack,
  backLabel = 'Retour',
  leading,
  trailing,
  className,
}: NavBarProps) {
  return (
    <div
      className={cn(
        '-mx-0.5 -mt-0.5 grid h-11 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2',
        className,
      )}
    >
      <div className={cn('flex', leading !== undefined && 'pl-0.5')}>
        {leading ?? (back && (
          <IconButton
            icon="back"
            label={backLabel}
            size="lg"
            iconSize={22}
            onClick={onBack}
          />
        ))}
      </div>
      {title ? (
        <h1 className="truncate text-center text-17 font-semibold text-ink">
          {title}
        </h1>
      ) : (
        <span />
      )}
      <div className="flex justify-end pr-0.5">{trailing}</div>
    </div>
  );
}

/**
 * A text action in the bar: black and semibold, like the mockups' "OK".
 * `tone="blue"` is the iOS link colour of a modal form ("Annuler",
 * "Enregistrer"); the dismissive side is then set `font-normal`.
 */
export function NavBarAction({
  tone = 'ink',
  className,
  type = 'button',
  ...props
}: ComponentProps<'button'> & { tone?: 'ink' | 'blue' }) {
  return (
    <button
      type={type}
      className={cn(
        'cursor-pointer text-17 font-semibold whitespace-nowrap text-ink outline-none',
        'focus-visible:ring-2 focus-visible:ring-blue active:opacity-60',
        tone === 'blue' && 'text-blue',
        className,
      )}
      {...props}
    />
  );
}
