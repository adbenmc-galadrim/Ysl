import { Icon } from '#icons';
import { cn } from '#lib/tv';

import {
  BuildingTile,
  Chevron,
  Coche,
  FillGroupRow,
  KraftLabel,
  ListPhoneRow,
  NavetteBar,
  NavetteBottom,
  NavetteScreen,
  RoundAvatar,
} from '#screens/multi-entreprises/08-rapprochement-du-destinataire/navette-parts';

const SUGGESTIONS = [
  { name: 'Léa Fontaine', detail: 'Finance · 4e étage', selected: true },
  { name: 'Lise Fontan', detail: 'Juridique · 5e étage', selected: false },
  { name: 'Louis Fontaine', detail: 'Studio · 2e étage', selected: false },
];

const DEPARTMENTS = [
  { name: 'Studio', detail: 'Bât. A, 2e étage, accueil', selected: false },
  { name: 'Finance', detail: 'Bât. B, 4e étage, bureau 412', selected: false },
  { name: 'Juridique', detail: 'Bât. B, 5e étage, secrétariat', selected: true },
];

/** An uncertain name: the label as evidence, and who it could be. */
export function PourQuiMobile() {
  return (
    <NavetteScreen bottom={<NavetteBottom>Valider : Finance</NavetteBottom>}>
      <NavetteBar title="1 sur 2" skip />
      <KraftLabel name="L. FONTAIN" />
      <h2 className="mt-[22px] text-22 font-bold">Pour qui est ce colis ?</h2>
      <p className="mt-[3px] text-14 text-muted">
        Nom lu sur l’étiquette : « L. FONTAIN »
      </p>
      <div className="mt-4 flex flex-col gap-2.5">
        {SUGGESTIONS.map((person) => (
          <div
            key={person.name}
            className={cn(
              'relative h-[60px] rounded-[14px]',
              person.selected
                ? 'bg-surface outline-2 -outline-offset-1 outline-black'
                : 'bg-fill',
            )}
          >
            <span className="absolute top-2.5 left-3">
              <RoundAvatar initials="LF" inverted={person.selected} />
            </span>
            <span className="absolute top-2.5 left-16 text-16 font-semibold">
              {person.name}
            </span>
            <span className="absolute top-[31px] left-16 flex items-center gap-[5px] text-13 text-ink-2">
              <Icon name="building" size={13} className="text-muted" />
              {person.detail}
            </span>
            <span className="absolute top-[18px] right-3">
              <Coche checked={person.selected} />
            </span>
          </div>
        ))}
      </div>
      <p className="mt-6 flex items-center gap-2.5 text-15 font-semibold">
        <Icon name="search" size={18} className="text-blue" />
        Chercher dans l’annuaire
      </p>
    </NavetteScreen>
  );
}

/** Nobody of that name: another search, the department alone, or later. */
export function DestinataireInconnuMobile() {
  return (
    <NavetteScreen
      bottom={<NavetteBottom variant="secondary">Garder à compléter</NavetteBottom>}
    >
      <NavetteBar title="2 sur 2" skip />
      <KraftLabel name="M. ROUSSEL" />
      <h2 className="mt-[22px] text-22 font-bold">Personne de ce nom</h2>
      <p className="mt-[3px] text-14 text-muted">
        Ni dans l’annuaire, ni dans les noms déjà vus.
      </p>
      <div className="mt-5 overflow-hidden rounded-[14px] bg-fill">
        <FillGroupRow icon="search" tileClass="bg-black" trailing={<span className="relative top-px"><Chevron /></span>}>
          Chercher un autre nom
        </FillGroupRow>
        <FillGroupRow
          icon="building"
          tileClass="bg-muted"
          trailing={<span className="relative top-px"><Chevron /></span>}
          separator={false}
        >
          Choisir seulement le département
        </FillGroupRow>
      </div>
      <p className="mt-[15px] text-13 leading-[15.6px] text-muted">
        Sans département, le colis reste au service courrier, « À compléter ».
        Aucun e-mail ne part.
      </p>
    </NavetteScreen>
  );
}

/** The department alone: it finds the person in its own directory. */
export function ChoisirDepartementMobile() {
  return (
    <NavetteScreen bottom={<NavetteBottom>Envoyer à Juridique</NavetteBottom>}>
      <NavetteBar title="Département" close />
      <p className="mt-3 h-[34px] text-14 leading-[17px] text-muted">
        Le département retrouvera « M. Roussel » dans son annuaire.
      </p>
      <div className="mt-2.5">
        {DEPARTMENTS.map((department) => (
          <ListPhoneRow
            key={department.name}
            height={72}
            leadingTop={16}
            leading={<BuildingTile selected={department.selected} />}
            title={department.name}
            detail={department.detail}
            trailingTop={24}
            trailing={<Coche checked={department.selected} />}
          />
        ))}
      </div>
    </NavetteScreen>
  );
}
