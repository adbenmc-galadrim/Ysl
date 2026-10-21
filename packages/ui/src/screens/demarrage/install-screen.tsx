import { PageIntro } from '#components/page-intro';
import { StepCard, type StepCardProps } from '#components/step-card';
import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';

/** The three gestures that put a PWA on the iOS home screen. */
export const INSTALL_STEPS: StepCardProps[] = [
  { icon: 'share', title: '1. Touchez Partager', hint: 'en bas de Safari' },
  {
    icon: 'plusSquare',
    title: '2. Choisissez « Sur l’écran d’accueil »',
    hint: 'puis touchez Ajouter',
  },
  {
    icon: 'package',
    title: '3. Ouvrez Courrier YSL',
    hint: 'depuis la nouvelle icône',
  },
];

const TOOLBAR: IconName[] = ['back', 'chevron', 'share', 'menu', 'copy'];

export type InstallScreenProps = {
  /** The address shown in Safari's bar. */
  host?: string;
  steps?: StepCardProps[];
};

/**
 * The page Safari shows before the app is installed. Safari's own chrome is
 * drawn around it, with the Partager button ringed in blue, because the
 * guide points at it: "en bas de Safari" has to match what the eye finds.
 */
export function InstallScreen({
  host = 'courrier.saintlaurent.fr',
  steps = INSTALL_STEPS,
}: InstallScreenProps) {
  return (
    <div className="flex h-full min-h-dvh w-full flex-col bg-white text-ink">
      {/* Safari's address bar starts under the 44 px status bar of a
          browser tab, not under the 50 px safe area of the installed app. */}
      <div className="flex h-[52px] shrink-0 items-center justify-center bg-fill px-[60px] mt-11">
        <span className="flex h-8 w-full max-w-[400px] items-center justify-center truncate rounded-[10px] bg-white text-14 text-ink-2">
          {host}
        </span>
      </div>
      <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col overflow-y-auto px-5">
        <PageIntro
          title="Installez l’app"
          description="Elle fonctionnera sans réseau et gardera vos colis en mémoire. Sans installation, Safari peut effacer les données après 7 jours."
          className="mt-7"
        />
        <ol className="mt-[55px] flex flex-col gap-3">
          {steps.map((step) => (
            <li key={step.icon}>
              <StepCard {...step} />
            </li>
          ))}
        </ol>
      </main>
      <nav
        aria-hidden="true"
        className="flex shrink-0 justify-between border-t border-border bg-fill px-[27px] pt-[15px] pb-[calc(var(--safe-bottom)+6px)]"
      >
        {TOOLBAR.map((icon) => (
          <span
            key={icon}
            className={cn(
              'flex text-muted',
              icon === 'share' &&
                '-mx-[9px] -my-[10px] items-center justify-center rounded-full px-[9px] py-[10px] text-blue ring-2 ring-blue ring-inset',
            )}
          >
            <Icon name={icon} size={24} />
          </span>
        ))}
      </nav>
    </div>
  );
}
