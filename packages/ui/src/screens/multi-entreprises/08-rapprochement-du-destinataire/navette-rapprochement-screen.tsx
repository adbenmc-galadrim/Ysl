import {
  PersonAvatar,
  PhoneRow,
  PhoneSettingRow,
  RoundTile,
  TickMark,
} from '#components/phone-parts';
import {
  RecipientPicker,
  ShuttleBar,
  ShuttleBottom,
  ShuttleScreen,
} from '#components/shuttle-parts';
import { RECIPIENT_RESULTS } from '#fixtures/multi-entreprises';
import { Icon } from '#icons';
import { cn } from '#lib/tv';

function KraftLabel({ name }: { name: string }) {
  return (
    <div className="relative mt-3 h-[150px] shrink-0 rounded-[16px] bg-kraft">
      <div className="absolute top-3.5 left-5 h-[122px] w-[313px] rounded-[4px] bg-paper">
        <p className="absolute top-[9px] left-3 text-[10px] font-semibold text-label-ink-3">
          Destinataire :
        </p>
        <p className="absolute top-[26px] left-3 font-label text-24 font-bold text-label-ink">
          {name}
        </p>
        <p className="absolute top-[59px] left-3 text-[9px] leading-3 text-label-line">
          12 RUE DES ATELIERS
          <br />
          75011 PARIS FR
        </p>
      </div>
      <span className="absolute top-[110px] left-[313px] flex size-7 items-center justify-center rounded-full bg-white text-black">
        <Icon name="zoom" size={14} />
      </span>
    </div>
  );
}

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
/** The whole directory, searched from the review of one label. */
export function ChoisirDestinataireMobile() {
  return <RecipientPicker query="fonta" results={RECIPIENT_RESULTS} />;
}

export function PourQuiMobile() {
  return (
    <ShuttleScreen bottom={<ShuttleBottom>Valider : Finance</ShuttleBottom>}>
      <ShuttleBar title="1 sur 2" skip />
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
              <PersonAvatar raised initials="LF" inverted={person.selected} />
            </span>
            <span className="absolute top-2.5 left-16 text-16 font-semibold">
              {person.name}
            </span>
            <span className="absolute top-[31px] left-16 flex items-center gap-[5px] text-13 text-ink-2">
              <Icon name="building" size={13} className="text-muted" />
              {person.detail}
            </span>
            <span className="absolute top-[18px] right-3">
              <TickMark checked={person.selected} />
            </span>
          </div>
        ))}
      </div>
      <p className="mt-6 flex items-center gap-2.5 text-15 font-semibold">
        <Icon name="search" size={18} className="text-blue" />
        Chercher dans l’annuaire
      </p>
    </ShuttleScreen>
  );
}

/** Nobody of that name: another search, the department alone, or later. */
export function DestinataireInconnuMobile() {
  return (
    <ShuttleScreen
      bottom={<ShuttleBottom variant="secondary">Garder à compléter</ShuttleBottom>}
    >
      <ShuttleBar title="2 sur 2" skip />
      <KraftLabel name="M. ROUSSEL" />
      <h2 className="mt-[22px] text-22 font-bold">Personne de ce nom</h2>
      <p className="mt-[3px] text-14 text-muted">
        Ni dans l’annuaire, ni dans les noms déjà vus.
      </p>
      <div className="mt-5 overflow-hidden rounded-[14px] bg-fill">
        <PhoneSettingRow
          icon={{ name: 'search', tone: 'ink' }}
          title="Chercher un autre nom"
          separator
        />
        <PhoneSettingRow
          icon={{ name: 'building', tone: 'grey' }}
          title="Choisir seulement le département"
        />
      </div>
      <p className="mt-[15px] text-13 leading-[15.6px] text-muted">
        Sans département, le colis reste au service courrier, « À compléter ».
        Aucun e-mail ne part.
      </p>
    </ShuttleScreen>
  );
}

/** The department alone: it finds the person in its own directory. */
export function ChoisirDepartementMobile() {
  return (
    <ShuttleScreen bottom={<ShuttleBottom>Envoyer à Juridique</ShuttleBottom>}>
      <ShuttleBar title="Département" close />
      <p className="mt-3 h-[34px] text-14 leading-[17px] text-muted">
        Le département retrouvera « M. Roussel » dans son annuaire.
      </p>
      <div className="mt-2.5">
        {DEPARTMENTS.map((department) => (
          <PhoneRow
            key={department.name}
            height={72}
            leading={<RoundTile icon="building" selected={department.selected} />}
            title={department.name}
            lines={[department.detail]}
            mark={<TickMark checked={department.selected} />}
            separator
          />
        ))}
      </div>
    </ShuttleScreen>
  );
}
