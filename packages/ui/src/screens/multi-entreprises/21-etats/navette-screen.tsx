import { PhoneRow } from '#components/phone-parts';
import { Screen } from '#components/screen';
import { SectionHeader } from '#components/section-header';
import {
  DockToast,
  PhoneDock,
  ProgressTrack,
  RootHeader,
  RowTile,
  StateHero,
} from '#screens/multi-entreprises/21-etats/etats-parts';

const ROOT = 'pt-[calc(var(--safe-top)+6px)]';
const DOCK = <PhoneDock icon="scan" label="Scanner" />;
const SUBTITLE = '1 département sur 4 déposé · 14 colis restent';

const STOPS = [
  { name: 'Studio', place: 'Bât. A, 2e étage, accueil', count: '6 colis' },
  { name: 'Finance', place: 'Bât. B, 4e étage, bureau 412', count: '5 colis' },
  { name: 'Juridique', place: 'Bât. B, 5e étage, secrétariat', count: '3 colis' },
];

function Round() {
  return (
    <>
      <ProgressTrack value={0.25} className="mt-2.5" />
      <SectionHeader title="À déposer" count={3} size="lg" className="relative -top-px mt-6 h-[27px]" />
      <div className="mt-[13px]">
        {STOPS.map((stop, i) => (
          <PhoneRow
            key={stop.name}
            height={68}
            leading={<RowTile icon="building" />}
            title={stop.name}
            lines={[stop.place]}
            before={<span className="text-17 font-semibold">{stop.count}</span>}
            separator={i < STOPS.length - 1}
          />
        ))}
      </div>
      <SectionHeader title="Déposés" count={1} size="lg" className="relative -top-px mt-3 h-[27px]" />
      <div className="mt-[13px]">
        <PhoneRow
          height={64}
          leading={<RowTile icon="check" className="bg-green-soft text-green" />}
          title="Service courrier"
          lines={['4 colis · confirmé à 8:40']}
        />
      </div>
    </>
  );
}

/** A deposit not sent because the server does not answer. */
export function TourneeErreurMobile() {
  return (
    <Screen className={ROOT} bottom={DOCK}>
      <RootHeader pill="unsent" title="Tournée" subtitle={SUBTITLE} />
      <Round />
      <DockToast message="1 dépôt non envoyé · le serveur ne répond pas" />
    </Screen>
  );
}

/** The round off the network: the deposit waits on the phone. */
export function TourneeHorsLigneMobile() {
  return (
    <Screen className={ROOT} bottom={DOCK}>
      <RootHeader pill="offline" title="Tournée" subtitle={SUBTITLE} />
      <Round />
      <DockToast message="1 dépôt en attente d’envoi" />
    </Screen>
  );
}

/** The shuttle's first day, before any scan. */
export function TourneePremiereFoisMobile() {
  return (
    <Screen className={ROOT} bottom={DOCK}>
      <RootHeader pill="synced" title="Tournée" />
      <StateHero
        top={220}
        icon="scan"
        title="Rien à déposer"
        text="Scannez les colis reçus : ils se rangent ici par département."
      />
    </Screen>
  );
}

/** Every department served. */
export function TourneeTermineeMobile() {
  return (
    <Screen className={ROOT} bottom={DOCK}>
      <RootHeader pill="synced" title="Tournée" subtitle="4 départements sur 4 déposés" />
      <ProgressTrack value={1} toneClass="bg-green" className="mt-2.5" />
      <StateHero
        top={250}
        icon="check"
        tone="green"
        title="Tout est déposé"
        text="18 colis, 4 dépôts confirmés. Les prochains colis apparaîtront ici après le scan."
      />
    </Screen>
  );
}
