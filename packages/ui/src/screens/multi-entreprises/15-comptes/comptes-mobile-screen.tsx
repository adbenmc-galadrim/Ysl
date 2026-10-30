import { Button } from '#components/button';
import { IconButton } from '#components/icon-button';
import { NavBar } from '#components/nav-bar';
import { Screen } from '#components/screen';
import { SearchField } from '#components/search-field';
import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';
import {
  PhoneDirectoryRow,
  PhoneField,
  PhoneSegments,
} from '#screens/multi-entreprises/14-annuaire/directory-parts';

function PhoneSection({
  title,
  count,
  className,
}: {
  title: string;
  count: number;
  className?: string;
}) {
  return (
    <h2 className={cn('flex h-6 gap-1.5 text-20 font-bold', className)}>
      {title}
      <span className="font-medium text-muted">{count}</span>
    </h2>
  );
}

function RowState({
  label,
  tone,
  width,
}: {
  label: string;
  tone: 'blue' | 'orange';
  width: number;
}) {
  return (
    <span
      className={cn(
        'absolute top-5 right-6 flex h-6 items-center gap-1.5 rounded-[12px] pl-[9px] text-13 font-semibold',
        tone === 'blue' ? 'bg-fill' : 'bg-orange-soft text-orange-strong',
      )}
      style={{ width }}
    >
      <span
        className={cn(
          'size-2 rounded-full',
          tone === 'blue' ? 'bg-blue' : 'bg-orange',
        )}
      />
      <span className="-mt-0.5">{label}</span>
    </span>
  );
}

/** Who can sign in to the company, by role, on the phone. */
export function AdminComptesMobile() {
  return (
    <Screen>
      <NavBar
        title="Comptes"
        trailing={
          <IconButton icon="userPlus" label="Inviter" size="lg" iconSize={22} />
        }
      />
      <SearchField placeholder="Nom ou e-mail" className="mt-4" />
      <PhoneSection title="Navettes" count={2} className="mt-5" />
      <div className="mt-2.5">
        <PhoneDirectoryRow initials="KD" name="Karim Daoud" detail="Service courrier" />
        <PhoneDirectoryRow initials="SL" name="Sophie Lambert" detail="Service courrier" />
      </div>
      <PhoneSection title="Départements" count={5} className="mt-2.5" />
      <div className="mt-2.5">
        <PhoneDirectoryRow initials="JP" name="Julie Perrin" detail="Studio" />
        <PhoneDirectoryRow initials="TM" name="Thomas Moreau" detail="Studio" />
        <PhoneDirectoryRow
          initials="NK"
          name="Nadia Kessler"
          detail="Finance"
          trailing={<RowState label="Invitation envoyée" tone="blue" width={140} />}
        />
        <PhoneDirectoryRow initials="BV" name="Bruno Vidal" detail="Juridique" />
        <PhoneDirectoryRow
          initials="ÉG"
          name="Élise Garnier"
          detail="Finance"
          trailing={<RowState label="Suspendu" tone="orange" width={93} />}
        />
      </div>
    </Screen>
  );
}

function AccountRow({
  icon,
  tileClass,
  label,
  value,
  chevron = false,
  separator = false,
  textTop = 17,
}: {
  icon: IconName;
  tileClass: string;
  label: string;
  value: string;
  chevron?: boolean;
  separator?: boolean;
  textTop?: number;
}) {
  return (
    <div className="relative h-[52px] text-16">
      <span
        className={cn(
          'absolute top-3 left-3.5 flex size-7 items-center justify-center rounded-[7px] text-white',
          tileClass,
        )}
      >
        <Icon name={icon} size={16} />
      </span>
      <span className="absolute left-14" style={{ top: textTop }}>
        {label}
      </span>
      <span
        className={cn(
          'absolute text-muted',
          chevron ? 'right-9' : 'right-[15px]',
        )}
        style={{ top: textTop }}
      >
        {value}
      </span>
      {chevron && (
        <Icon
          name="chevron"
          size={16}
          className="absolute top-[18px] right-3.5 text-faint"
        />
      )}
      {separator && (
        <div className="absolute right-0 bottom-0 left-14 h-px bg-separator" />
      )}
    </div>
  );
}

/** The record of one account: its role, where it sits, what can be done to it. */
export function AdminCompteMobile() {
  return (
    <Screen tone="fill">
      <NavBar />
      <div className="relative mt-3 h-14">
        <span className="absolute top-0 left-0 flex size-14 items-center justify-center rounded-full bg-surface text-20 font-semibold">
          JP
        </span>
        <p className="absolute -top-px left-[68px] text-24 font-bold">Julie Perrin</p>
        <p className="absolute top-[31px] left-[68px] text-14 text-muted">
          julie.perrin@atelier-lumen.fr
        </p>
      </div>
      <div className="mt-7 rounded-[14px] bg-surface">
        <AccountRow
          icon="building"
          tileClass="bg-muted"
          label="Rôle"
          value="Département"
          separator
        />
        <AccountRow
          icon="pin"
          tileClass="bg-ios-red-light"
          label="Rattachement"
          value="Studio"
          chevron
          separator
        />
        <AccountRow
          icon="clock"
          tileClass="bg-muted"
          label="Dernière connexion"
          value="10:51"
          textTop={16}
        />
      </div>
      <div className="mt-7 rounded-[14px] bg-surface text-16">
        <div className="relative h-[52px] pt-4 pl-4">
          Renvoyer un lien de mot de passe
          <div className="absolute right-0 bottom-0 left-4 h-px bg-separator" />
        </div>
        <div className="h-[52px] pt-[17px] pl-4 text-red">Suspendre le compte</div>
      </div>
    </Screen>
  );
}

/** Inviting a department account; `taken` is the address already known. */
export function AdminInviterMobile({ taken = false }: { taken?: boolean }) {
  return (
    <Screen
      tone="fill"
      bottom={
        <div className="h-[112px] border-t border-separator bg-surface px-5 pt-[23px]">
          <Button block icon="send" iconSize={20} className="gap-2">
            Envoyer l’invitation
          </Button>
        </div>
      }
    >
      <NavBar
        title="Inviter"
        leading={
          <IconButton
            icon="x"
            label="Fermer"
            size="lg"
            iconSize={22}
            className="-ml-0.5"
          />
        }
      />
      <p className="relative -top-px mt-4 h-4 pl-4 text-13 font-medium text-muted">Rôle</p>
      <PhoneSegments
        label="Rôle"
        options={['Navette', 'Département', 'Admin']}
        value="Département"
        className="mt-2 h-11 rounded-[22px]"
        optionClassName="h-10 rounded-[20px] pb-[3px] text-14"
      />
      <div className="mt-5 flex flex-col gap-4">
        <PhoneField label="Département" value="Finance" chevron />
        <PhoneField label="Prénom et nom" value="Nadia Kessler" />
        <PhoneField
          label="E-mail professionnel"
          value="nadia.kessler@atelier-lumen.fr"
          boxClassName={
            taken ? 'shadow-[inset_0_0_0_1.5px_var(--color-red)]' : undefined
          }
        />
      </div>
      <p className={cn('relative -top-px mt-1.5 text-13', taken ? 'text-red' : 'text-muted')}>
        {taken
          ? 'Cette adresse a déjà un compte ou une invitation en attente.'
          : 'Un lien valable 7 jours lui sera envoyé.'}
      </p>
    </Screen>
  );
}
