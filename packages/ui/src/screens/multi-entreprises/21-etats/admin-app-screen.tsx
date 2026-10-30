import { Screen } from '#components/screen';
import { Skeleton } from '#components/skeleton';
import {
  HeroButton,
  PhoneDock,
  RetryHero,
  RootHeader,
  SkeletonRows,
  StateHero,
} from '#screens/multi-entreprises/21-etats/etats-parts';

const ROOT = 'pt-[calc(var(--safe-top)+6px)]';

/** The companies list while it loads. */
export function EntreprisesChargementMobile() {
  return (
    <Screen className={ROOT} bottom={<PhoneDock icon="plus" label="Nouvelle" />}>
      <RootHeader title="Entreprises" />
      <Skeleton width={200} height={14} radius={6} className="mt-[18px]" />
      <SkeletonRows count={6} pitch={80} className="mt-[52px]" />
    </Screen>
  );
}

/** The companies list when the server does not answer. */
export function EntreprisesErreurMobile() {
  return (
    <Screen className={ROOT}>
      <RootHeader title="Entreprises" />
      <RetryHero top={260} />
    </Screen>
  );
}

/** The platform before its first client company. */
export function EntreprisesVideMobile() {
  return (
    <Screen className={ROOT}>
      <RootHeader title="Entreprises" subtitle="Aucune entreprise cliente" />
      <StateHero
        top={280}
        icon="building"
        title="Pas encore d’entreprise"
        text="Créez la première : choisissez un modèle de fonctionnement, puis invitez son administrateur."
        textHeight={60}
        action={
          <HeroButton icon="plus" width={240}>
            Créer une entreprise
          </HeroButton>
        }
      />
    </Screen>
  );
}
