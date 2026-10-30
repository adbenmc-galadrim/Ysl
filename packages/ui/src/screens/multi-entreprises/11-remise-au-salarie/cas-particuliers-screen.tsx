import { Avatar } from '#components/avatar';
import { Button } from '#components/button';
import { Chip } from '#components/chip';
import { IconButton } from '#components/icon-button';
import { NavBar } from '#components/nav-bar';
import { Screen } from '#components/screen';
import { SearchField } from '#components/search-field';
import { Sheet } from '#components/sheet';
import { Icon, type IconName } from '#icons';
import {
  PhoneBanner,
  PhoneRow,
} from '#screens/multi-entreprises/10-colis/phone-parts';
import {
  DoneDisc,
  PhoneAction,
  ProofCard,
} from '#screens/multi-entreprises/11-remise-au-salarie/remise-parts';

const Initials = ({ initials }: { initials: string }) => (
  <Avatar initials={initials} tone="fill" className="rounded-full bg-fill-2 text-14" />
);

/** Someone else collects: the employee or a colleague of the department. */
export function QuiRetireMobile() {
  return (
    <Screen bottom={<PhoneAction>Continuer</PhoneAction>}>
      <NavBar
        leading={<IconButton icon="x" label="Fermer" size="lg" iconSize={22} className="-ml-0.5" />}
        title="Qui retire ?"
      />
      <h1 className="mt-3 text-22 font-bold">Colis de Nora Haddad</h1>
      <SearchField
        placeholder="Chercher dans le Studio"
        className="mt-[18px] shrink-0 gap-2 rounded-[12px] pl-3"
      />
      <div className="mt-4">
        <PhoneRow leading={<Initials initials="NH" />} title="Nora Haddad" lines={['Destinataire']} trailing="tick" separator />
        <PhoneRow leading={<Initials initials="JF" />} title="Julien Faure" lines={['Studio · collègue']} separator />
        <PhoneRow leading={<Initials initials="CR" />} title="Camille Roux" lines={['Studio · collègue']} />
      </div>
      <PhoneBanner
        icon="lock"
        iconClassName="text-ink-2"
        title="Seulement un collègue du Studio"
        description="Réglage d’Atelier Lumen ; une signature est demandée."
        height={83}
        className="mt-5"
      />
    </Screen>
  );
}

/** A colleague has signed for the employee, who is told by e-mail. */
export function RetireParCollegueMobile() {
  return (
    <Screen bottom={<PhoneAction>Terminé</PhoneAction>}>
      <DoneDisc />
      <h1 className="mt-6 text-center text-26 font-bold">Remis à Julien Faure</h1>
      <p className="mt-[9px] text-center text-15 text-muted">
        pour Nora Haddad · Studio · 11:24
      </p>
      <ProofCard
        items={[
          { icon: 'user', label: 'Collègue du Studio vérifié' },
          { icon: 'sign', label: 'Signature de Julien Faure' },
          { icon: 'mail', label: 'Nora Haddad prévenue par e-mail' },
        ]}
      />
    </Screen>
  );
}

function SheetNote({
  icon,
  title,
  description,
  className,
  tint,
}: {
  icon: IconName;
  title: string;
  description: string;
  className: string;
  tint: string;
}) {
  return (
    <div className={`relative shrink-0 rounded-[16px] ${tint} ${className}`}>
      <Icon name={icon} size={20} className="absolute top-1/2 left-3.5 -translate-y-1/2" />
      <p className="absolute top-3.5 left-[46px] text-15 font-semibold">{title}</p>
      <p className="absolute top-9 left-[46px] text-13">{description}</p>
    </div>
  );
}

const REASONS = [
  { label: 'Mauvais colis', width: 132.1, selected: true },
  { label: 'Mauvaise personne', width: 162.9 },
  { label: 'Erreur de saisie', width: 155.2 },
];

/** Cancelling a handover: why, and what becomes of the parcel. */
export function AnnulerRemiseMobile() {
  return (
    <Sheet
      title="Annuler la remise ?"
      scrimClassName="bg-black/35"
      className="h-[616px] pb-0"
      behind={
        <Screen>
          <NavBar />
          <h1 className="mt-3.5 text-32 font-bold">Malik Benali</h1>
          <p className="mt-1 text-15 text-muted">Finance, Chronopost ···31JB</p>
        </Screen>
      }
    >
      <SheetNote
        icon="check"
        tint="bg-green-soft text-green"
        title="Remis hier à 9 h 12"
        description="À Malik Benali, QR code vérifié, par Karim"
        className="mt-2.5 h-16"
      />
      <p className="relative -top-px mt-5 h-4 text-13 font-medium text-muted">Pourquoi ?</p>
      <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-2.5">
        {REASONS.map((reason) => (
          <Chip key={reason.label} selected={reason.selected} style={{ width: reason.width }} className="px-0">
            {reason.label}
          </Chip>
        ))}
      </div>
      <p className="relative -top-px mt-[18px] h-4 text-13 font-medium text-muted">Précision</p>
      <div className="mt-1.5 flex h-[52px] shrink-0 items-center rounded-[14px] bg-fill pl-4 text-17 font-medium">
        Le colis remis était celui de M. Bernard
      </div>
      <SheetNote
        icon="info"
        tint="bg-fill text-blue-strong"
        title="Le colis repasse en attente de retrait"
        description="L’annulation reste dans l’historique, avec son motif."
        className="mt-6 h-[72px]"
      />
      <Button variant="destructive" block className="mt-[92px] shrink-0">
        Annuler la remise
      </Button>
    </Sheet>
  );
}
