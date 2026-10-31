import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { CompanyLogo } from '#components/company-parts';
import { HeroTile } from '#components/hero-tile';
import { Screen } from '#components/screen';
import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';

/** The camera request, with what the permission is used for. */
export function AutoriserCameraMobile() {
  return (
    <Screen
      className="pt-[170px]"
      bottom={
        <BottomBar surface="plain" className="flex-col gap-[18px] pt-0 pb-[55px]">
          <Button block>
            <span className="relative -top-px">Autoriser la caméra</span>
          </Button>
          <p className="pr-px text-center text-16 font-semibold text-blue">
            Importer une photo à la place
          </p>
        </BottomBar>
      }
    >
      <HeroTile icon="camera" size="xl" className="ml-[116px] self-start" />
      <h1 className="relative -top-px mt-9 text-center text-28 font-bold">Autoriser la caméra</h1>
      <p className="mt-3 ml-[11px] h-[92px] w-[330px] text-center text-16 leading-[1.45] whitespace-break-spaces text-muted">
        Elle sert à lire les étiquettes et les QR codes de retrait. iOS peut
        redemander l’accès à chaque ouverture de l’app : c’est normal, il suffit
        d’accepter.
      </p>
      <div className="mt-12 flex h-14 items-start gap-3 rounded-[16px] bg-fill pt-2.5 pl-3.5">
        <Icon name="check" size={20} className="mt-2 shrink-0 text-green" />
        <p className="w-[290px] text-14 leading-[1.4] text-ink-2">
          Rien ne quitte le téléphone : la lecture se fait sur l’iPhone.
        </p>
      </div>
    </Screen>
  );
}

const STEPS = [
  'Ouvrez Réglages sur l’iPhone',
  'Touchez Safari, puis Caméra',
  'Choisissez « Autoriser »',
  'Revenez dans Courrier YSL',
];

/** The camera refused: how to allow it again, and what works meanwhile. */
export function CameraRefuseeMobile() {
  return (
    <Screen
      className="pt-[136px]"
      bottom={
        <BottomBar surface="plain" className="pt-0 pb-14">
          <Button block>
            <span className="relative -top-px">J’ai réautorisé, réessayer</span>
          </Button>
        </BottomBar>
      }
    >
      <HeroTile icon="camera" tone="red" size="lg" crossed className="ml-[126px] self-start" />
      <h1 className="mt-[26px] text-center text-26 font-bold">
        La caméra est bloquée
      </h1>
      <p className="mt-[9px] ml-[11px] w-[330px] text-center text-16 leading-[1.45] text-muted">
        L’accès a été refusé. Pour scanner, réautorisez-le dans les réglages de
        l’iPhone.
      </p>
      <ol className="mt-9 flex flex-col gap-5">
        {STEPS.map((step, index) => (
          <li key={step} className="flex h-8 items-center gap-3.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-fill text-14 font-bold">
              <span className="relative -top-px">{index + 1}</span>
            </span>
            <span className="relative -top-px text-16 leading-5">{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-[37px] text-13 font-medium text-muted">En attendant</p>
      <div className="mt-[11px] flex gap-3">
        <Button variant="secondary" icon="image" iconSize={20} className="w-[170px] justify-start gap-[7.7px] pl-[32.3px] text-16">
          <span className="relative -top-px">Une photo</span>
        </Button>
        <Button variant="secondary" icon="keyboard" iconSize={20} className="w-[171px] justify-start gap-[8.5px] pl-[28.5px] text-16">
          <span className="relative -top-px">Au clavier</span>
        </Button>
      </div>
    </Screen>
  );
}

const INSTALL_STEPS: { icon: IconName; title: string; hint: string }[] = [
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

const SAFARI_ICONS: IconName[] = ['back', 'chevron', 'share', 'menu', 'copy'];

function SafariBar() {
  return (
    <div className="relative flex h-20 justify-between border-t border-border bg-fill px-[27px] pt-[15px]">
      {SAFARI_ICONS.map((icon) => (
        <Icon
          key={icon}
          name={icon}
          size={24}
          className={icon === 'share' ? 'text-ink' : 'text-muted'}
        />
      ))}
      <span className="absolute top-[5px] left-[175px] size-[42px] rounded-full border-2 border-blue" />
    </div>
  );
}

/** Safari on the phone, with the three steps to add the app to the home screen. */
export function InstallerAppMobile() {
  return (
    <Screen className="pt-11" bottom={<SafariBar />}>
      <div className="-mx-5 h-[52px] bg-fill pt-2.5">
        <p className="mx-auto h-8 w-[273px] rounded-[10px] bg-surface pt-1.5 text-center text-14 text-ink-2">
          courrier.saintlaurent.fr
        </p>
      </div>
      <h1 className="mt-7 text-32 font-bold">Installez l’app</h1>
      <p className="mt-1.5 text-15 leading-[1.4] text-muted">
        Elle fonctionnera sans réseau et gardera vos colis en mémoire. Sans
        installation, Safari peut effacer les données après 7 jours.
      </p>
      <ul className="mt-[55px] flex flex-col gap-3">
        {INSTALL_STEPS.map((step) => (
          <li
            key={step.title}
            className="flex h-[72px] items-center gap-3.5 rounded-[16px] bg-fill pl-4"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-surface">
              <Icon name={step.icon} size={22} />
            </span>
            <div>
              <p className="relative -top-px text-16 font-semibold">{step.title}</p>
              <p className="relative -top-0.5 mt-1 text-14 text-muted">{step.hint}</p>
            </div>
          </li>
        ))}
      </ul>
    </Screen>
  );
}

const DOWNLOADS: {
  icon: IconName;
  tileClass: string;
  label: string;
  value: string;
}[] = [
  {
    icon: 'users',
    tileClass: 'bg-ios-orange-light',
    label: 'Annuaire de l’entreprise',
    value: '312',
  },
  {
    icon: 'scan',
    tileClass: 'bg-black',
    label: 'Lecture des étiquettes',
    value: '42 Mo',
  },
  {
    icon: 'route',
    tileClass: 'bg-muted',
    label: 'Tournée en cours',
    value: '14 colis',
  },
];

/** The offline download running, and what it brings onto the phone. */
export function PreparationHorsLigneMobile() {
  return (
    <Screen className="pt-[120px]">
      <CompanyLogo initials="AL" className="ml-36 size-16 rounded-[16px] text-26" />
      <h1 className="mt-5 text-center text-26 font-bold">
        Préparation hors ligne
      </h1>
      <p className="mt-[7px] text-center text-15 text-muted">
        Atelier Lumen · Navette
      </p>
      <div className="mt-10 ml-5 h-1.5 w-[313px] rounded-[3px] bg-fill-2">
        <div className="h-full w-[194px] rounded-[3px] bg-ink" />
      </div>
      <p className="relative -top-px mt-3 text-center text-13 text-muted">
        62 % · 27 Mo sur 44 Mo
      </p>
      <ul className="mt-9 h-[156px] overflow-hidden rounded-[14px] bg-fill">
        {DOWNLOADS.map((row, index) => (
          <li key={row.label} className="relative flex h-[52px] items-center pr-3.5 pl-3.5">
            <span
              className={cn(
                'flex size-7 items-center justify-center rounded-[7px] text-white',
                row.tileClass,
              )}
            >
              <Icon name={row.icon} size={16} />
            </span>
            <span className="ml-3.5 flex-1 text-16 leading-5">{row.label}</span>
            <span className="text-16 leading-5 text-muted">{row.value}</span>
            {index < DOWNLOADS.length - 1 && (
              <span className="absolute right-0 bottom-0 left-14 h-px bg-separator" />
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3.5 ml-4 w-[320px] text-13 leading-[1.2] text-muted">
        Un compte département télécharge seulement son annuaire et ses colis.
      </p>
    </Screen>
  );
}

const PACKS: {
  icon: IconName;
  label: string;
  detail: string;
  progress: number;
  paused?: boolean;
}[] = [
  { icon: 'users', label: 'Annuaire', detail: '312 personnes', progress: 301 },
  {
    icon: 'scan',
    label: 'Lecture des étiquettes',
    detail: '18 Mo sur 42 Mo, en pause',
    progress: 129.43,
    paused: true,
  },
  { icon: 'image', label: 'Écrans et polices', detail: '6 Mo', progress: 301 },
];

/** The download stopped by a lost Wi-Fi: the app can already be used by hand. */
export function TelechargementInterrompuMobile() {
  return (
    <Screen
      className="pt-28"
      bottom={
        <BottomBar surface="plain" className="flex-col gap-4 pt-0 pb-14">
          <Button variant="secondary" block>
            <span className="relative -top-px">Utiliser les données mobiles (24 Mo)</span>
          </Button>
          <Button block>
            <span className="relative -top-px">Commencer en saisie manuelle</span>
          </Button>
        </BottomBar>
      }
    >
      <h1 className="text-32 leading-[1.15] font-bold">Préparation hors ligne</h1>
      <p className="mt-2 text-15 leading-[1.4] text-muted">
        Le téléchargement s’est arrêté : la connexion Wi-Fi a été perdue.
      </p>
      <ul className="mt-[49px]">
        {PACKS.map((pack) => (
          <li key={pack.label} className="relative h-[92px]">
            <span
              className={cn(
                'absolute top-0 left-0 flex size-10 items-center justify-center rounded-full',
                pack.paused ? 'bg-orange/12 text-orange' : 'bg-green/12 text-green',
              )}
            >
              <Icon name={pack.icon} size={20} />
            </span>
            <p className="absolute top-0 left-[52px] text-17 leading-[21px] font-semibold">
              {pack.label}
            </p>
            <p
              className={cn(
                'absolute top-[22px] left-[52px] text-14',
                pack.paused ? 'text-orange' : 'text-muted',
              )}
            >
              {pack.detail}
            </p>
            {pack.paused ? (
              <Icon
                name="wifiOff"
                size={20}
                className="absolute top-2.5 left-[331px] text-orange"
              />
            ) : (
              <Icon
                name="check"
                size={22}
                className="absolute top-[9px] left-[330px] text-green"
              />
            )}
            <div className="absolute top-[52px] left-[52px] h-1.5 w-[301px] rounded-[3px] bg-separator">
              <div
                className={cn(
                  'h-full rounded-[3px]',
                  pack.paused ? 'bg-orange' : 'bg-green',
                )}
                style={{ width: pack.progress }}
              />
            </div>
          </li>
        ))}
      </ul>
      <div className="relative mt-2 h-[92px] rounded-[16px] bg-fill pt-3.5 pl-[46px] text-blue-strong">
        <Icon name="info" size={20} className="absolute top-9 left-3.5" />
        <p className="text-15 font-semibold">Vous pouvez déjà commencer</p>
        <p className="mt-1 w-[290px] text-13 leading-[1.35]">
          Sans la lecture automatique, les colis se saisissent au clavier. Elle
          s’activera dès la fin du téléchargement.
        </p>
      </div>
    </Screen>
  );
}
