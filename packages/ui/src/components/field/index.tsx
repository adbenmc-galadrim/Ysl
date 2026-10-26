import { useId, type ComponentProps, type ReactNode } from 'react';

import { Icon, type IconName } from '#icons';
import { cn, tv, type VariantProps } from '#lib/tv';

const helpTone = {
  muted: 'text-muted',
  green: 'text-green',
  orange: 'text-orange',
  red: 'text-red',
} as const;

export type FieldProps = {
  label: ReactNode;
  /** One line under the box: a check result, what the value is used for. */
  help?: ReactNode;
  helpTone?: keyof typeof helpTone;
  /**
   * Receives the id the label points at, so the control is named by it.
   * A plain node is fine for controls that carry their own label.
   */
  children: ReactNode | ((id: string) => ReactNode);
  className?: string;
};

/**
 * A form field: small grey label, the 52 px box, an optional help line. The
 * label sits above rather than inside the box so it stays readable once the
 * box is filled — the agent checks what the scan read, field by field.
 */
export function Field({
  label,
  help,
  helpTone: tone = 'muted',
  children,
  className,
}: FieldProps) {
  const id = useId();
  return (
    <div className={cn('flex flex-col', className)}>
      <label htmlFor={id} className="text-13 font-medium text-muted">
        {label}
      </label>
      <div className="mt-1.5">
        {typeof children === 'function' ? children(id) : children}
      </div>
      {help && <p className={cn('mt-2 text-13', helpTone[tone])}>{help}</p>}
    </div>
  );
}

export const fieldBoxVariants = tv({
  base: [
    'flex h-[52px] w-full items-center gap-3 rounded-control pr-3.5 pl-4 text-left text-17 font-medium text-ink',
    'outline-none focus-within:ring-2 focus-within:ring-blue focus-within:ring-inset',
  ],
  variants: {
    variant: {
      /** Grey, the resting state of every field. */
      fill: 'bg-fill',
      /** Surface with a 2 px ink edge: the field being typed into. */
      outline: 'bg-surface ring-2 ring-ink ring-inset',
    },
    /** Tracking numbers: monospaced so 0/O and 1/I can be told apart. */
    mono: { true: 'font-mono' },
  },
  defaultVariants: { variant: 'fill' },
});

export type FieldInputProps = ComponentProps<'input'> &
  VariantProps<typeof fieldBoxVariants> & {
    /** An icon button or a glyph at the right end, e.g. scan again. */
    trailing?: ReactNode;
  };

/** A text box. The placeholder is lighter than a value, as in iOS. */
export function FieldInput({
  variant,
  mono,
  trailing,
  className,
  ...props
}: FieldInputProps) {
  return (
    <div className={fieldBoxVariants({ variant, mono, class: className })}>
      <input
        className="h-full min-w-0 flex-1 bg-transparent caret-blue outline-none placeholder:font-normal placeholder:text-muted"
        {...props}
      />
      {trailing}
    </div>
  );
}

export type FieldSelectProps = Omit<ComponentProps<'button'>, 'children'> &
  VariantProps<typeof fieldBoxVariants> & {
    value?: ReactNode;
    placeholder?: string;
    /** `chevron` opens a picker screen; another icon, another action. */
    icon?: IconName;
  };

/**
 * A field whose value is picked on another screen — a recipient from the
 * directory, a carrier — so it is a button, not an input.
 */
export function FieldSelect({
  value,
  placeholder,
  icon = 'chevron',
  variant,
  mono,
  className,
  type = 'button',
  ...props
}: FieldSelectProps) {
  return (
    <button
      type={type}
      className={fieldBoxVariants({
        variant,
        mono,
        class: [
          'cursor-pointer focus-visible:ring-2 focus-visible:ring-blue',
          className,
        ],
      })}
      {...props}
    >
      <span
        className={cn(
          'min-w-0 flex-1 truncate',
          !value && 'font-normal text-muted',
        )}
      >
        {value || placeholder}
      </span>
      <Icon name={icon} size={20} className="shrink-0 text-muted" />
    </button>
  );
}

export type FieldPickerOption = { value: string; label: string };

export type FieldPickerProps = Omit<
  ComponentProps<'select'>,
  'children' | 'value' | 'onChange'
> & {
  value: string;
  options: readonly FieldPickerOption[];
  onValueChange?: (value: string) => void;
  /** Shown while nothing is picked; also the empty choice of the list. */
  placeholder?: string;
};

/**
 * A field picked from a short fixed list — a carrier — drawn as
 * `FieldSelect`, with the iPhone's own wheel under the finger: a native
 * `<select>` lies invisible over the box.
 */
export function FieldPicker({
  value,
  options,
  onValueChange,
  placeholder,
  className,
  ...props
}: FieldPickerProps) {
  const label = options.find((option) => option.value === value)?.label;
  return (
    <div
      className={fieldBoxVariants({
        class: ['relative focus-within:ring-blue', className],
      })}
    >
      <span
        aria-hidden="true"
        className={cn(
          'min-w-0 flex-1 truncate',
          !label && 'font-normal text-muted',
        )}
      >
        {label ?? placeholder}
      </span>
      <Icon name="chevron" size={20} className="shrink-0 text-muted" />
      <select
        value={value}
        onChange={(event) => onValueChange?.(event.target.value)}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
        {...props}
      >
        <option value="">{placeholder ?? ''}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** A square icon button inside a field box, e.g. "Scanner à nouveau". */
export function FieldAction({
  icon,
  label,
  className,
  type = 'button',
  ...props
}: Omit<ComponentProps<'button'>, 'children'> & {
  icon: IconName;
  label: string;
}) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(
        'flex shrink-0 cursor-pointer text-ink outline-none focus-visible:ring-2 focus-visible:ring-blue',
        className,
      )}
      {...props}
    >
      <Icon name={icon} size={20} />
    </button>
  );
}
