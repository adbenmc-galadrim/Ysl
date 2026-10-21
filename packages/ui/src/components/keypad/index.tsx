import { Icon } from '#icons';
import { cn } from '#lib/tv';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

const keyClass = [
  // Keys are drawn 2 px tighter than the fields above them.
  'flex h-[54px] cursor-pointer items-center justify-center rounded-[calc(var(--radius-control)-2px)] bg-fill',
  'text-24 font-medium text-ink outline-none select-none',
  'focus-visible:ring-2 focus-visible:ring-blue',
  'transition-[filter] active:brightness-90',
];

export type KeypadProps = {
  onDigit?: (digit: string) => void;
  onDelete?: () => void;
  className?: string;
};

/**
 * The on-screen digit pad. The code is typed by the agent while the
 * recipient reads it aloud, so the keys are as big as the column allows
 * and the system keyboard — which would cover the code boxes — never opens.
 */
export function Keypad({ onDigit, onDelete, className }: KeypadProps) {
  return (
    <div className={cn('grid grid-cols-3 gap-x-2.5 gap-y-2', className)}>
      {DIGITS.map((digit) => (
        <button
          key={digit}
          type="button"
          className={cn(keyClass)}
          onClick={() => onDigit?.(digit)}
        >
          {digit}
        </button>
      ))}
      {/* The bottom-left key stays empty, as on the iOS passcode pad. */}
      <span aria-hidden="true" />
      <button
        type="button"
        className={cn(keyClass)}
        onClick={() => onDigit?.('0')}
      >
        0
      </button>
      <button
        type="button"
        aria-label="Effacer"
        className={cn(keyClass)}
        onClick={onDelete}
      >
        <Icon name="back" size={24} />
      </button>
    </div>
  );
}
