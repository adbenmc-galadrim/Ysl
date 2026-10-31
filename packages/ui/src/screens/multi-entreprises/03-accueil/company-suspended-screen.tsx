import { Button } from '#components/button';
import { HeroTile } from '#components/hero-tile';

export type CompanySuspendedScreenProps = {
  title: string;
  description: string;
  /** What still waits on the phone; absent when nothing does. */
  pending?: string;
  retryLabel: string;
  onRetry?: () => void;
};

/**
 * A suspended company's phone: it says what happened and that nothing is lost.
 * No way out from here, as a sign-out would empty the phone of its proofs.
 */
export function CompanySuspendedScreen({
  title,
  description,
  pending,
  retryLabel,
  onRetry,
}: CompanySuspendedScreenProps) {
  return (
    <main className="flex h-dvh min-h-0 flex-col items-center justify-center overflow-y-auto bg-surface px-6 text-center text-ink">
      <HeroTile icon="pause" size="lg" />
      <h1 className="mt-6 text-22 font-bold">{title}</h1>
      <p className="mt-2 max-w-[420px] text-16 leading-[23px] text-muted">
        {description}
      </p>
      {pending && <p className="mt-4 text-14 text-ink-2">{pending}</p>}
      <Button
        variant="outline"
        icon="refresh"
        onClick={onRetry}
        className="mt-6 w-full max-w-[280px]"
      >
        {retryLabel}
      </Button>
    </main>
  );
}
