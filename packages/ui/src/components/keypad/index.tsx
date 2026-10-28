import { useState } from 'react';

import { Icon } from '#icons';
import { cn } from '#lib/tv';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];

const keyClass = [
  // Keys are drawn 2 px tighter than the fields above them.
  'flex h-[54px] cursor-pointer items-center justify-center rounded-[calc(var(--radius-control)-2px)] bg-fill',
  'text-24 font-medium text-ink outline-none select-none',
  'focus-visible:ring-2 focus-visible:ring-blue',
  'transition-[filter] active:brightness-90',
  'disabled:cursor-default disabled:opacity-40 disabled:active:brightness-100',
];

export type KeypadProps = {
  onDigit?: (digit: string) => void;
  /** Adds the "ABC" key, and the letter grid behind it. */
  onLetter?: (letter: string) => void;
  /** Opens on the letters rather than the digits. */
  letters?: boolean;
  onDelete?: () => void;
  /** Every key greyed out and inert: too many wrong codes, a wait before the next. */
  disabled?: boolean;
  className?: string;
};

/**
 * The on-screen digit pad. The code is typed by the agent while the
 * recipient reads it aloud, so the keys are as big as the column allows
 * and the system keyboard — which would cover the code boxes — never opens.
 *
 * A tracking number also carries letters (`1Z…`, `8J…`, `HA…JB`): with
 * `onLetter`, the empty bottom-left key switches to the letters, laid out
 * over the same four rows so the sheet never jumps.
 */
export function Keypad({
  onDigit,
  onLetter,
  onDelete,
  letters: initialLetters = false,
  disabled = false,
  className,
}: KeypadProps) {
  const [letters, setLetters] = useState(initialLetters);
  const erase = (
    <button
      type="button"
      disabled={disabled}
      aria-label="Effacer"
      className={cn(keyClass)}
      onClick={onDelete}
    >
      <Icon name="back" size={24} />
    </button>
  );
  if (letters && onLetter) {
    return (
      <div className={cn('grid grid-cols-7 gap-x-1.5 gap-y-2', className)}>
        {LETTERS.map((letter) => (
          <button
            key={letter}
            type="button"
            disabled={disabled}
            className={cn(keyClass, 'text-20')}
            onClick={() => onLetter(letter)}
          >
            {letter}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          aria-label="Chiffres"
          className={cn(keyClass, 'text-15 font-semibold')}
          onClick={() => setLetters(false)}
        >
          123
        </button>
        {erase}
      </div>
    );
  }
  return (
    <div className={cn('grid grid-cols-3 gap-x-2.5 gap-y-2', className)}>
      {DIGITS.map((digit) => (
        <button
          key={digit}
          type="button"
          disabled={disabled}
          className={cn(keyClass)}
          onClick={() => onDigit?.(digit)}
        >
          {digit}
        </button>
      ))}
      {onLetter ? (
        <button
          type="button"
          disabled={disabled}
          aria-label="Lettres"
          className={cn(keyClass, 'text-17 font-semibold')}
          onClick={() => setLetters(true)}
        >
          ABC
        </button>
      ) : (
        // The bottom-left key stays empty, as on the iOS passcode pad.
        <span aria-hidden="true" />
      )}
      <button
        type="button"
        disabled={disabled}
        className={cn(keyClass)}
        onClick={() => onDigit?.('0')}
      >
        0
      </button>
      {erase}
    </div>
  );
}
