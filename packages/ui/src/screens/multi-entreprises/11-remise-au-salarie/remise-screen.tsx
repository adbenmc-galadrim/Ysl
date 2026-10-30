import type { ReactNode } from 'react';

import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { CameraTopBar } from '#components/camera-controls';
import { CameraViewport } from '#components/camera-viewport';
import { IconButton } from '#components/icon-button';
import { NavBar, NavBarAction } from '#components/nav-bar';
import {
  KraftThumb,
  PhoneBanner,
  PhoneRow,
  PhoneSection,
  TickMark,
} from '#components/phone-parts';
import { Screen } from '#components/screen';
import { Toast } from '#components/toast';
import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';
import {
  CounterScene,
  DoneDisc,
  EmployeePhone,
  PhoneAction,
  ProofCard,
  ScanCorners,
} from '#screens/multi-entreprises/11-remise-au-salarie/remise-parts';

function CameraShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <CameraViewport video={<CounterScene />} frame={false} floor={false}>
      <CameraTopBar
        title={title}
        titleStyle="text"
        className="px-[18px] [&_svg]:size-[22px]"
      />
      {children}
    </CameraViewport>
  );
}

/** The first step: the camera on the QR of the employee's e-mail. */
export function ScannerQrMobile() {
  return (
    <CameraShell title="Remise · Studio">
      <EmployeePhone />
      <ScanCorners x={96} y={236} size={200} color="bg-white" />
      <p className="absolute inset-x-0 top-[560px] text-center text-17 font-semibold">
        Scannez le QR de l’e-mail du salarié
      </p>
      <div className="absolute top-[760px] left-5 flex gap-3">
        <Button
          variant="light"
          size="md"
          icon="hash"
          iconSize={20}
          className="h-12 w-[170px] justify-start gap-2 rounded-[24px] pr-0 pl-[22.5px]"
        >
          Taper le code
        </Button>
        <Button
          variant="light"
          size="md"
          icon="search"
          iconSize={20}
          className="h-12 w-[171px] justify-start gap-2 rounded-[24px] pr-0 pl-[9px]"
        >
          Chercher un nom
        </Button>
      </div>
    </CameraShell>
  );
}

/** The QR is another department's: nothing was handed over. */
export function CodeAutreDepartementMobile() {
  return (
    <CameraShell title="Remise · Studio">
      <EmployeePhone />
      <ScanCorners x={96} y={236} size={200} color="bg-ios-red" />
      <div className="absolute top-[540px] left-5 h-40 w-[353px] rounded-[18px] bg-night">
        <Icon name="alert" size={20} className="absolute top-[18px] left-4 text-ios-red" />
        <p className="absolute top-4 left-[46px] text-17 font-semibold">
          Ce colis est à Finance
        </p>
        <p className="absolute top-[41px] left-[46px] w-[290px] text-14 text-night-muted">
          Léa Fontaine le retire au bâtiment B, 4e étage, bureau 412. Rien n’a
          été remis.
        </p>
        <Button
          variant="light"
          size="md"
          className="absolute top-24 left-4 h-12 w-[321px] rounded-[24px]"
        >
          Scanner un autre code
        </Button>
      </div>
    </CameraShell>
  );
}

/** Scanning each parcel, when the company asks for it. */
export function ScanColisMobile() {
  return (
    <CameraShell title="1 sur 2">
      <div className="absolute top-[200px] left-[86px] h-[300px] w-[220px] rounded-[8px] bg-kraft">
        <div className="absolute top-[30px] left-5 h-[150px] w-[180px] rounded-[4px] bg-paper font-label font-bold text-label-ink">
          <p className="absolute top-3 left-3 text-18">amazon</p>
          <p className="absolute top-[50px] left-3 text-14">NORA HADDAD</p>
          <span className="absolute top-24 left-3 h-[38px] w-[156px] bg-label-ink" />
        </div>
      </div>
      <ScanCorners x={76} y={210} size={240} color="bg-ios-green" />
      <div className="absolute top-[600px] left-5 h-[72px] w-[353px] rounded-[18px] bg-night">
        <Icon name="check" size={20} className="absolute top-[26px] left-4 text-ios-green" />
        <p className="absolute top-4 left-[46px] text-15 font-semibold">
          Amazon ···4471 · c’est le bon colis
        </p>
        <p className="absolute top-[39px] left-[46px] text-13 text-night-muted">
          Plus qu’un à scanner
        </p>
      </div>
    </CameraShell>
  );
}

function PersonHeader({ subtitle }: { subtitle: string }) {
  return (
    <div className="mt-3 flex h-[52px] shrink-0 gap-3">
      <span className="flex size-[52px] items-center justify-center rounded-full bg-ink text-[19px] leading-[23px] font-semibold text-on-ink">
        NH
      </span>
      <div>
        <h1 className="text-26 font-bold">Nora Haddad</h1>
        <p className="relative -top-px mt-[3px] text-14 text-muted">{subtitle}</p>
      </div>
    </div>
  );
}

function OptionRow({
  icon,
  label,
  value,
}: {
  icon: IconName;
  label: string;
  value?: string;
}) {
  return (
    <div className="flex h-[52px] items-center pl-3.5 text-16">
      <span className="flex size-7 items-center justify-center rounded-[7px] bg-muted text-white">
        <Icon name={icon} size={16} />
      </span>
      <span className="ml-3.5 min-w-0 flex-1">{label}</span>
      {value && <span className="mr-1.5 text-muted">{value}</span>}
      <Icon name="chevron" size={16} className="mr-3.5 text-faint" />
    </div>
  );
}

/** The QR is verified: the employee's parcels, each to be scanned. */
export function SesColisMobile() {
  return (
    <Screen bottom={<PhoneAction icon="scan">Scanner les 2 colis</PhoneAction>}>
      <NavBar />
      <PersonHeader subtitle="Studio · 2e étage" />
      <div className="mt-5 flex h-11 shrink-0 items-center gap-2.5 rounded-[12px] bg-green-soft pl-3.5 text-15 font-semibold text-green">
        <Icon name="check" size={18} />
        QR vérifié à 11:20
      </div>
      <PhoneSection title="Ses colis" count={2} className="mt-5" />
      <div className="mt-2.5">
        <PhoneRow leading={<KraftThumb />} title="Amazon ···4471" lines={['À scanner']} mark={<TickMark />} separator />
        <PhoneRow leading={<KraftThumb />} title="Amazon ···4472" lines={['À scanner']} mark={<TickMark />} />
      </div>
      <PhoneBanner
        icon="scan"
        iconClassName="text-ink-2"
        title="Scan du colis demandé"
        description="Scannez chaque colis remis (réglage de l’entreprise)."
        height={83}
        className="mt-4"
      />
      <div className="relative mt-[11px] h-[104px] shrink-0 rounded-[14px] bg-fill">
        <OptionRow icon="user" label="Retiré par quelqu’un d’autre" />
        <span className="absolute top-[51px] right-0 left-14 h-px bg-separator" />
        <OptionRow icon="sign" label="Faire signer" value="Facultatif" />
      </div>
    </Screen>
  );
}

/** The small-site profile: the shuttle hands over by itself. */
export function NavetteRemiseMobile() {
  return (
    <Screen bottom={<PhoneAction>Remettre 1 colis</PhoneAction>}>
      <NavBar />
      <PersonHeader subtitle="Remis par la navette" />
      <PhoneBanner
        icon="truck"
        title="La navette fait office de département"
        description="Profil « Petit site » : Karim remet lui-même, au service courrier."
        height={83}
        descriptionClassName="text-ink"
        className="mt-[26px]"
      />
      <PhoneSection title="Ses colis" count={1} className="mt-[27px]" />
      <div className="mt-2.5">
        <PhoneRow leading={<KraftThumb />} title="UPS ···8810" lines={['Reçu hier']} mark={<TickMark />} />
      </div>
    </Screen>
  );
}

const CODE_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '‹'];

/** The code read aloud, when it belongs to another department. */
export function CodeRetraitMobile() {
  return (
    <Screen>
      <NavBar title="Code de retrait" />
      <p className="mt-5 text-center text-15 text-muted">
        Code à 4 chiffres reçu par e-mail
      </p>
      <div className="mt-[18px] flex justify-center gap-2">
        {['5', '1', '0', '7'].map((digit, i) => (
          <span
            key={i}
            className="flex h-16 w-[54px] items-center justify-center rounded-[12px] border-[1.5px] border-red text-28 font-semibold"
          >
            {digit}
          </span>
        ))}
      </div>
      <PhoneBanner
        tone="red"
        icon="alert"
        title="Ce code est pour Finance"
        description="Le colis de Léa Fontaine se retire au bâtiment B, 4e étage. Rien n’a été remis."
        height={83}
        className="mt-6"
      />
      <div className="mt-[143px] grid grid-cols-[112px_112px_112px] gap-2">
        {CODE_KEYS.map((key, i) =>
          key ? (
            <span
              key={key}
              className="flex h-14 items-center justify-center rounded-[12px] bg-fill text-26 font-medium"
            >
              {key}
            </span>
          ) : (
            <span key={i} />
          ),
        )}
      </div>
    </Screen>
  );
}

/** The signature the company requires. */
export function SignatureMobile() {
  return (
    <Screen bottom={<PhoneAction>Valider la signature</PhoneAction>}>
      <NavBar
        leading={<IconButton icon="x" label="Fermer" size="lg" iconSize={22} className="-ml-0.5" />}
        title="Signature"
        trailing={<NavBarAction className="font-normal">Effacer</NavBarAction>}
      />
      <h1 className="mt-3 text-22 font-bold">Nora Haddad signe pour 2 colis</h1>
      <p className="relative -top-px mt-[5px] text-14 text-muted">
        Signature obligatoire chez Atelier Lumen
      </p>
      <div className="relative mt-[25px] h-[380px] shrink-0 rounded-[16px] bg-fill">
        <svg
          aria-label="Signature"
          role="img"
          viewBox="0 0 353 380"
          className="absolute inset-0 size-full fill-none stroke-ink"
          strokeWidth={3}
        >
          <path d="M60,230C80,150,100,260,120,200C140,140,160,170,180,210C200,250,230,180,280,200" />
        </svg>
        <span className="absolute top-[301px] left-10 h-px w-[273px] bg-border" />
        <p className="absolute inset-x-0 top-[320px] text-center text-13 text-muted">
          Signez avec le doigt
        </p>
      </div>
    </Screen>
  );
}

/** The handover recorded, with the undo still on offer. */
export function RemiseConfirmeeMobile() {
  return (
    <Screen
      bottom={
        <div>
          <div className="mb-3 px-5">
            <Toast
              message="Remise enregistrée"
              actionLabel="Annuler"
              className="rounded-[14px] px-4 [&>button]:text-white"
            />
          </div>
          <BottomBar surface="plain" className="pt-6 pb-9">
            <Button block>Terminé</Button>
          </BottomBar>
        </div>
      }
    >
      <DoneDisc />
      <h1 className={cn('mt-6 text-center text-28 font-bold')}>2 colis remis</h1>
      <p className="mt-1.5 text-center text-15 text-muted">
        à Nora Haddad, à 11:21 · Studio
      </p>
      <ProofCard
        items={[
          { icon: 'qr', label: 'QR code vérifié' },
          { icon: 'scan', label: '2 colis scannés' },
          { icon: 'cloud', label: 'Envoyé au serveur' },
        ]}
      />
    </Screen>
  );
}
