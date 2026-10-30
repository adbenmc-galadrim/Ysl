import { cn } from '#lib/tv';

export type DeskTab = {
  id: string;
  /** With its count, as drawn: "Présents 12". */
  label: string;
  /** Penpot's estimate of the label's width, which places the next tab. */
  width?: number;
};

export type DeskTabsProps = {
  tabs: DeskTab[];
  active: string;
  onChange?: (id: string) => void;
  /** Accessible name: "Colis du département". */
  label: string;
  className?: string;
};

/** The underlined tabs of a desktop page, on a hairline the width of the page. */
export function DeskTabs({
  tabs,
  active,
  onChange,
  label,
  className,
}: DeskTabsProps) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('flex gap-6 border-b border-separator', className)}
    >
      {tabs.map((tab) => {
        const current = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={current}
            onClick={() => onChange?.(tab.id)}
            style={{ width: tab.width }}
            className={cn(
              'h-7 cursor-pointer border-b-2 text-left align-top text-14 whitespace-nowrap outline-none',
              'focus-visible:ring-2 focus-visible:ring-blue',
              current
                ? 'border-ink font-semibold text-ink'
                : 'border-transparent text-muted',
            )}
          >
            <span className="relative -top-px block h-[26px]">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
