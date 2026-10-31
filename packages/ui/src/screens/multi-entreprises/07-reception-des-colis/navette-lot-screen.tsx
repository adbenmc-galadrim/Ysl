import { KraftThumb, PhoneRow, PhoneSettingRow, TickMark } from '#components/phone-parts';
import {
  RecipientPicker,
  ShuttleBar,
  ShuttleBottom,
  ShuttleScreen,
} from '#components/shuttle-parts';
import { RECIPIENT_RESULTS } from '#fixtures/multi-entreprises';
import { Icon } from '#icons';

/** The whole directory, searched from the batch being reviewed. */
export function ChoisirDestinataireMobile() {
  return <RecipientPicker query="fonta" results={RECIPIENT_RESULTS} queryRaised />;
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
    <ShuttleScreen bottom={<ShuttleBottom>Enregistrer 12 colis</ShuttleBottom>}>
      <ShuttleBar />
      <h1 className="mt-2 text-34 font-bold tracking-[-0.4px]">Vérifier le lot</h1>
      <p className="mt-[5px] text-15 text-muted">
        12 colis lus · 2 demandent votre avis
      </p>
      <div className="mt-6">
        <Heading title="À vérifier" count={2} />
      </div>
      <div className="mt-2.5">
        {TO_CHECK.map((row, i) => (
          <PhoneRow
            key={row.title}
            height={64}
            leading={<KraftThumb />}
            title={row.title}
            titleTone="red"
            lines={[row.detail]}
            separator={i === 0}
          />
        ))}
      </div>
      <div className="mt-[22px]">
        <Heading title="Prêts" count={10} />
      </div>
      <div className="mt-2.5">
        {READY.map((row) => (
          <PhoneRow
            key={row.title}
            height={60}
            leading={<KraftThumb />}
            title={row.title}
            lines={[row.detail]}
            mark={<TickMark checked />}
            separator
          />
        ))}
      </div>
    </ShuttleScreen>
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
    <ShuttleScreen
      bottom={<ShuttleBottom icon="route">Partir en tournée</ShuttleBottom>}
    >
      <span className="mx-auto mt-[92px] flex size-[88px] items-center justify-center rounded-full bg-green text-white">
        <Icon name="tick" size={44} />
      </span>
      <h1 className="mt-[23px] text-center text-28 font-bold">12 colis en route</h1>
      <p className="mt-[7px] text-center text-15 text-muted">Lot de 10:31 à 10:52</p>
      <div className="mt-[30px] overflow-hidden rounded-[14px] bg-fill">
        {OUTCOMES.map((outcome) => (
          <PhoneSettingRow
            key={outcome.name}
            icon={{ name: 'building', tone: 'grey' }}
            title={outcome.name}
            value={<span className="text-16 text-muted">{outcome.count}</span>}
            chevron={false}
            separator
          />
        ))}
        <PhoneSettingRow
          icon={{ name: 'alert', tone: 'alert' }}
          title="À compléter"
          value={<span className="text-16 text-muted">1</span>}
          chevron={false}
        />
      </div>
      <p className="mt-[11px] text-center text-13 leading-[15.6px] text-muted">
        Les salariés seront prévenus par e-mail au dépôt, selon le réglage de
        l’entreprise.
      </p>
    </ShuttleScreen>
  );
}
