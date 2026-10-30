import { Banner } from '#components/banner';
import { Button } from '#components/button';
import { IconButton } from '#components/icon-button';
import { NavBar, NavBarAction } from '#components/nav-bar';
import { Screen } from '#components/screen';
import { SearchField } from '#components/search-field';
import { Icon } from '#icons';
import { cn } from '#lib/tv';
import {
  PhoneDirectoryRow,
  PhoneField,
  PhoneLetter,
  PhoneSegments,
} from '#screens/multi-entreprises/14-annuaire/directory-parts';

function AddButton() {
  return <IconButton icon="plus" label="Ajouter" size="lg" iconSize={22} />;
}

/** The department's directory on the phone, sorted by first letter. */
export function DepartementAnnuaireMobile() {
  return (
    <Screen>
      <NavBar title="Annuaire du Studio" trailing={<AddButton />} />
      <SearchField placeholder="Nom ou e-mail" className="mt-4" />
      <PhoneLetter className="mt-4">A</PhoneLetter>
      <div className="mt-1.5">
        <PhoneDirectoryRow initials="AM" name="Antoine Martin" detail="2e étage" />
        <PhoneDirectoryRow initials="AB" name="Axelle Bernard" detail="2e étage" />
      </div>
      <PhoneLetter className="mt-3.5">C</PhoneLetter>
      <div className="mt-1.5">
        <PhoneDirectoryRow initials="CM" name="Camille Morel" detail="poste 214" />
      </div>
    </Screen>
  );
}

function CloseLeading() {
  return (
    <IconButton
      icon="x"
      label="Fermer"
      size="lg"
      iconSize={22}
      className="-ml-0.5"
    />
  );
}

/** The department adds an employee to its own directory. */
export function DepartementAjouterMobile() {
  return (
    <Screen tone="fill">
      <NavBar
        title="Nouveau salarié"
        leading={<CloseLeading />}
        trailing={<NavBarAction className="mr-px">Ajouter</NavBarAction>}
      />
      <div className="mt-4 flex flex-col gap-4">
        <PhoneField label="Prénom et nom" value="Jules Perret" />
        <PhoneField label="E-mail" value="jules.perret@atelier-lumen.fr" />
        <PhoneField label="Lieu (facultatif)" value="2e étage" />
      </div>
      <p className="mt-[26px] pl-4 text-13 text-muted">
        Ajouté au Studio. Ses colis y seront déposés.
      </p>
    </Screen>
  );
}

/** The address belongs to someone in another department: the add is refused. */
export function DepartementAjouterDejaAilleursMobile() {
  return (
    <Screen tone="fill">
      <NavBar
        title="Nouveau salarié"
        leading={<CloseLeading />}
        trailing={
          <NavBarAction disabled className="mr-px text-faint">
            Ajouter
          </NavBarAction>
        }
      />
      <div className="mt-4 flex flex-col gap-4">
        <PhoneField label="Prénom et nom" value="Hugo Lefèvre" />
        <PhoneField
          label="E-mail"
          value="hugo.lefevre@atelier-lumen.fr"
          boxClassName="shadow-[0_0_0_0.75px_var(--color-orange),inset_0_0_0_0.75px_var(--color-orange)]"
        />
      </div>
      <Banner
        tone="orange"
        icon="alert"
        title="Déjà dans l’annuaire de Finance"
        description={
          <>
            Demandez à l’administrateur de le déplacer au Studio.
            <span className="mt-[10px] block text-15 font-semibold">
              Demander le déplacement
            </span>
          </>
        }
        className="mt-7 h-[109px] items-start gap-2.5 rounded-[14px] py-0 pr-4 pl-4"
        classNames={{
          icon: 'mt-4',
          title: 'mt-[15px] text-15',
          description: 'mt-0.5 text-13 leading-[15.6px]',
        }}
      />
    </Screen>
  );
}

/** The company's whole directory on the phone, filtered by department. */
export function AdminAnnuaireMobile() {
  return (
    <Screen>
      <NavBar title="Annuaire" trailing={<AddButton />} />
      <SearchField placeholder="Nom, département, e-mail" className="mt-4" />
      <PhoneSegments
        label="Département"
        options={['Tous', 'Studio', 'Finance', 'Juridique']}
        value="Tous"
        className="mt-3 h-9 rounded-[18px]"
        optionClassName="h-8 rounded-2xl pb-[3px] text-13"
      />
      <PhoneLetter className="mt-5">C</PhoneLetter>
      <div className="mt-1.5">
        <PhoneDirectoryRow initials="CM" name="Camille Morel" detail="Studio" />
        <PhoneDirectoryRow initials="CR" name="Claire Robin" detail="Finance" />
      </div>
      <PhoneLetter className="mt-3.5">H</PhoneLetter>
      <div className="mt-1.5">
        <PhoneDirectoryRow initials="HD" name="Hélène Dubois" detail="Finance" />
        <PhoneDirectoryRow initials="HL" name="Hugo Lefèvre" detail="Studio" />
      </div>
    </Screen>
  );
}

function MoveOption({
  label,
  note,
  chosen = false,
  separator = false,
}: {
  label: string;
  note?: string;
  chosen?: boolean;
  separator?: boolean;
}) {
  return (
    <div className="relative h-[52px] pt-[17px] pl-4 text-16">
      <span className={cn(chosen && 'font-semibold')}>{label}</span>
      {note && <span className="absolute right-[15px] text-muted">{note}</span>}
      {chosen && (
        <Icon name="tick" size={16} className="absolute top-[18px] right-3" />
      )}
      {separator && (
        <div className="absolute inset-x-0 bottom-0 ml-4 h-px bg-separator" />
      )}
    </div>
  );
}

/** The administrator moves an employee: one parcel will need settling. */
export function AdminDeplacerMobile() {
  return (
    <div className="relative h-full min-h-dvh w-full overflow-hidden">
      <Screen tone="fill">
        <NavBar title="Camille Morel" />
      </Screen>
      <div className="absolute inset-0 z-[60] bg-black/32">
        <section
          role="dialog"
          aria-modal="true"
          aria-label="Déplacer vers"
          className="absolute inset-x-0 top-[250px] h-[632px] rounded-t-[24px] bg-surface px-5 pt-2 text-ink"
        >
          <span
            aria-hidden="true"
            className="mx-auto block h-[5px] w-9 rounded-[3px] bg-faint"
          />
          <h2 className="mt-[17px] text-22 font-bold">Déplacer vers</h2>
          <div className="mt-3.5 rounded-[14px] bg-fill">
            <MoveOption label="Studio" note="Actuel" separator />
            <MoveOption label="Finance" chosen separator />
            <MoveOption label="Juridique" />
          </div>
          <Banner
            tone="orange"
            icon="alert"
            title="1 colis passera « À régulariser »"
            description="Il est déjà déposé au Studio. Le colis en route ira à Finance."
            className="mt-3.5 h-[83px] items-start gap-2.5 rounded-[14px] py-0 pr-4 pl-4"
            classNames={{
              icon: 'mt-4',
              title: 'mt-[15px] text-15',
              description: 'mt-0.5 text-13 leading-[15.6px]',
            }}
          />
          <Button block className="mt-[37px]">
            Déplacer vers Finance
          </Button>
        </section>
        <span
          aria-hidden="true"
          className="absolute top-[843px] left-[130px] h-[5px] w-[134px] rounded-[3px] bg-black"
        />
      </div>
    </div>
  );
}
