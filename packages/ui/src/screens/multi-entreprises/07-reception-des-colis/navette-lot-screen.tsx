import { Icon } from '#icons';

import {
  ChoisirDestinataireMobile,
  Coche,
  Chevron,
  FillGroupRow,
  ListPhoneRow,
  NavetteBar,
  NavetteBottom,
  NavetteScreen,
} from '#screens/multi-entreprises/08-rapprochement-du-destinataire/navette-parts';

export { ChoisirDestinataireMobile };

function Thumb() {
  return (
    <span className="relative block size-10 rounded-[8px] bg-[#b89b78]">
      <span className="absolute top-[8.8px] left-[7.2px] h-5 w-[25.6px] rounded-[2px] bg-paper" />
      <span className="absolute top-3 left-[10.4px] h-[1.5px] w-4 bg-[#666666]" />
      <span className="absolute top-[16.8px] left-[10.4px] h-[1.5px] w-4 bg-[#666666]" />
      <span className="absolute top-[22px] left-[10.4px] h-1 w-[19.2px] bg-[#111111]" />
    </span>
  );
}

const TO_CHECK = [
  {
    title: 'Destinataire incertain',
    detail: 'Colissimo ···7505 · « L. FONTAIN »',
  },
  { title: 'Personne de ce nom', detail: 'UPS ···0091 · « M. ROUSSEL »' },
];

const READY = [
  { title: 'Camille Morel', detail: 'Studio' },
  { title: 'Hugo Lefèvre', detail: 'Studio' },
  { title: 'Nora Haddad', detail: 'Finance' },
  { title: 'Paul Mercier', detail: 'Juridique' },
  { title: 'Inès Garnier', detail: 'Studio' },
];

function Heading({ title, count }: { title: string; count: number }) {
  return (
    <h2 className="flex h-6 gap-1.5 text-20 font-bold">
      {title}
      <span className="font-medium text-muted">{count}</span>
    </h2>
  );
}

/** Batch review: what needs the driver first, the ready parcels under it. */
export function RevueLotMobile() {
  return (
    <NavetteScreen bottom={<NavetteBottom>Enregistrer 12 colis</NavetteBottom>}>
      <NavetteBar />
      <h1 className="mt-2 text-34 font-bold tracking-[-0.4px]">Vérifier le lot</h1>
      <p className="mt-[5px] text-15 text-muted">
        12 colis lus · 2 demandent votre avis
      </p>
      <div className="mt-6">
        <Heading title="À vérifier" count={2} />
      </div>
      <div className="mt-2.5">
        {TO_CHECK.map((row, i) => (
          <ListPhoneRow
            key={row.title}
            height={64}
            leadingTop={12}
            leading={<Thumb />}
            title={row.title}
            titleClass="text-red"
            detail={row.detail}
            trailingTop={24}
            trailing={<Chevron />}
            separator={i === 0}
          />
        ))}
      </div>
      <div className="mt-[22px]">
        <Heading title="Prêts" count={10} />
      </div>
      <div className="mt-2.5">
        {READY.map((row) => (
          <ListPhoneRow
            key={row.title}
            height={60}
            leadingTop={10}
            leading={<Thumb />}
            title={row.title}
            detail={row.detail}
            trailingTop={18}
            trailing={<Coche checked />}
          />
        ))}
      </div>
    </NavetteScreen>
  );
}

const OUTCOMES = [
  { name: 'Studio', count: 6 },
  { name: 'Finance', count: 3 },
  { name: 'Juridique', count: 2 },
];

/** The batch is saved and on its way: where each parcel goes. */
export function LotEnRouteMobile() {
  return (
    <NavetteScreen
      bottom={<NavetteBottom icon="route">Partir en tournée</NavetteBottom>}
    >
      <span className="mx-auto mt-[92px] flex size-[88px] items-center justify-center rounded-full bg-green text-white">
        <Icon name="tick" size={44} />
      </span>
      <h1 className="mt-[23px] text-center text-28 font-bold">12 colis en route</h1>
      <p className="mt-[7px] text-center text-15 text-muted">Lot de 10:31 à 10:52</p>
      <div className="mt-[30px] overflow-hidden rounded-[14px] bg-fill">
        {OUTCOMES.map((outcome) => (
          <FillGroupRow
            key={outcome.name}
            icon="building"
            tileClass="bg-muted"
            trailing={<span className="text-16 text-muted">{outcome.count}</span>}
          >
            {outcome.name}
          </FillGroupRow>
        ))}
        <FillGroupRow
          icon="alert"
          tileClass="bg-red"
          trailing={<span className="text-16 text-muted">1</span>}
          separator={false}
        >
          À compléter
        </FillGroupRow>
      </div>
      <p className="mt-[11px] text-center text-13 leading-[15.6px] text-muted">
        Les salariés seront prévenus par e-mail au dépôt, selon le réglage de
        l’entreprise.
      </p>
    </NavetteScreen>
  );
}
