import type { ReactNode } from 'react';

import { Button } from '#components/button';
import { IconButton } from '#components/icon-button';
import { LargeTitle } from '#components/large-title';
import { NavBar } from '#components/nav-bar';
import {
  KraftThumb,
  PhoneBanner,
  PhoneRow,
  RoundTile,
  TickMark,
} from '#components/phone-parts';
import { ProgressBar } from '#components/progress-bar';
import { Screen } from '#components/screen';
import { Icon } from '#icons';
import {
  DepositBottom,
  DepositGroup,
  DepositQrScene,
  DepositTimeline,
} from '#screens/multi-entreprises/09-depot-au-departement/deposit-parts';

const CLOSE = (
  <IconButton icon="x" label="Fermer" size="lg" iconSize={22} />
);

export type TourStopParcel = { id: string; title: string; line: string };

export type TourStopScreenProps = {
  name: string;
  subtitle: string;
  parcels: readonly TourStopParcel[];
  /** The deposit itself, once there is one. */
  action?: ReactNode;
  onBack?: () => void;
  onParcel?: (id: string) => void;
};

/** The parcels the shuttle carries for one department, before it deposits them. */
export function TourStopScreen({
  name,
  subtitle,
  parcels,
  action,
  onBack,
  onParcel,
}: TourStopScreenProps) {
  return (
    <Screen bottom={action ? <DepositBottom>{action}</DepositBottom> : undefined}>
      <NavBar onBack={onBack} />
      <LargeTitle
        title={<span className="tracking-[-0.4px]">{name}</span>}
        subtitle={subtitle}
        className="mt-2 gap-[5px]"
      />
      <div className="mt-6">
        {parcels.map((parcel, i) => (
          <button
            key={parcel.id}
            type="button"
            className="block w-full cursor-pointer text-left"
            onClick={onParcel && (() => onParcel(parcel.id))}
          >
            <PhoneRow
              leading={<KraftThumb />}
              title={parcel.title}
              lines={[parcel.line]}
              chevron={false}
              separator={i < parcels.length - 1}
            />
          </button>
        ))}
      </div>
    </Screen>
  );
}

export function NavetteDepartementADeposer() {
  return (
    <TourStopScreen
      name="Studio"
      subtitle="Bât. A, 2e étage, accueil · 6 colis"
      parcels={[
        { id: '1', title: 'Camille Morel', line: 'UPS ···0622' },
        { id: '2', title: 'Hugo Lefèvre', line: 'DHL ···7112' },
        { id: '3', title: 'Inès Garnier', line: 'FedEx ···3338' },
        { id: '4', title: 'Axelle Bernard', line: 'UPS ···2210' },
        { id: '5', title: 'Samuel Petit', line: 'Amazon, 2 colis' },
      ]}
      action={
        <Button icon="qr" iconSize={20} className="gap-2">
          Déposer au Studio
        </Button>
      }
    />
  );
}

export type DepositScanScreenProps = {
  video?: ReactNode;
  department?: string;
  torch?: boolean;
  /** The hint, or what went wrong with the camera. */
  hint: ReactNode;
  listLabel: string;
  onClose?: () => void;
  onTorch?: () => void;
  onList?: () => void;
};

/** The camera looking for the poster of the department. */
export function DepositScanScreen({
  video,
  department,
  torch,
  hint,
  listLabel,
  onClose,
  onTorch,
  onList,
}: DepositScanScreenProps) {
  return (
    <DepositQrScene
      department={department}
      video={video}
      torch={torch}
      onClose={onClose}
      onTorch={onTorch}
    >
      <p className="absolute top-[560px] left-[47px] w-[300px] text-center text-17 leading-[20.4px] font-semibold">
        {hint}
      </p>
      <Button
        variant="light"
        size="md"
        icon="list"
        iconSize={20}
        className="absolute top-[760px] left-[76px] h-12 w-60"
        onClick={onList}
      >
        {listLabel}
      </Button>
    </DepositQrScene>
  );
}

export function NavetteScannerQr() {
  return (
    <DepositScanScreen
      department="Studio"
      hint={
        <>
          Visez le QR affiché au point de&nbsp;
          <br />
          réception
        </>
      }
      listLabel="Choisir dans la liste"
    />
  );
}

export type DepositOtherQrScreenProps = {
  video?: ReactNode;
  department?: string;
  torch?: boolean;
  title: string;
  text: string;
  /** Nothing to put down there: the card only says so. */
  action?: { label: string; onClick: () => void };
  onClose?: () => void;
  onTorch?: () => void;
};

/** The poster read belongs to another department the shuttle also serves. */
export function DepositOtherQrScreen({
  video,
  department,
  torch,
  title,
  text,
  action,
  onClose,
  onTorch,
}: DepositOtherQrScreenProps) {
  return (
    <DepositQrScene
      department={department}
      video={video}
      torch={torch}
      onClose={onClose}
      onTorch={onTorch}
      wrong
    >
      <div className="absolute top-[540px] left-5 h-[150px] w-[353px] rounded-[18px] bg-night">
        <Icon name="alert" size={20} className="absolute top-[18px] left-4 text-ios-red" />
        <p className="absolute top-4 left-[46px] text-17 font-semibold">
          {title}
        </p>
        <p className="absolute top-[41px] left-[46px] text-14 text-night-muted">
          {text}
        </p>
        {action && (
          <Button
            variant="light"
            size="md"
            className="absolute top-[86px] left-4 h-12 w-[321px]"
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        )}
      </div>
    </DepositQrScene>
  );
}

export function NavetteQrAutreDepartement() {
  return (
    <DepositOtherQrScreen
      department="Finance"
      title="C’est le QR de Finance"
      text="Vous avez 5 colis pour Finance. Déposer ici ?"
      action={{ label: 'Déposer à Finance', onClick: () => undefined }}
    />
  );
}

export type DepositCountScreenProps = {
  /** « QR du Studio lu »; nothing when chosen from the list. */
  read?: string;
  count: number;
  countLine: string;
  hint: ReactNode;
  listLabel: string;
  actionLabel: string;
  onAction?: () => void;
  onClose?: () => void;
  onList?: () => void;
};

/** The department is confirmed by its QR: how many parcels are put down. */
export function DepositCountScreen({
  read,
  count,
  countLine,
  hint,
  listLabel,
  actionLabel,
  onAction,
  onClose,
  onList,
}: DepositCountScreenProps) {
  return (
    <Screen
      bottom={
        <DepositBottom>
          <Button onClick={onAction}>{actionLabel}</Button>
        </DepositBottom>
      }
    >
      <NavBar
        leading={
          <IconButton
            icon="x"
            label="Fermer"
            size="lg"
            iconSize={22}
            onClick={onClose}
          />
        }
        className="[&>div:first-child]:pl-0"
      />
      {read ? (
        <span className="mt-3 flex h-7 w-fit items-center gap-1 rounded-full bg-green-soft pr-2.5 pl-2 text-green">
          <Icon name="check" size={14} />
          <span className="relative -top-px text-13 font-semibold">{read}</span>
        </span>
      ) : (
        <span className="mt-3 block h-7" />
      )}
      <p className="mt-[60px] text-center text-[120px] leading-[144px] font-bold tracking-[-4px]">
        {count}
      </p>
      <p className="mt-2 text-center text-22 font-semibold">{countLine}</p>
      <p className="mx-auto mt-2.5 w-[300px] text-center text-15 text-muted">
        {hint}
      </p>
      <button
        type="button"
        className="mt-[26px] block w-full cursor-pointer text-left"
        onClick={onList}
      >
        <DepositGroup
          items={[{ icon: 'list', title: listLabel, chevron: true }]}
        />
      </button>
    </Screen>
  );
}

export function NavetteNombreDeColis() {
  return (
    <DepositCountScreen
      read="QR du Studio lu"
      count={6}
      countLine="colis à poser au Studio"
      hint={
        <>
          Posez-les à l’accueil et demandez qu’on les&nbsp;
          <br />
          compte.
        </>
      }
      listLabel="Voir les 6 colis"
      actionLabel="J’ai posé 6 colis"
    />
  );
}

export type DepositWaitingScreenProps = {
  title: string;
  text: ReactNode;
  posted: { title: string; value: string };
  status: { title: string; value: string };
  note: string;
  actionLabel: string;
  onAction?: () => void;
  onClose?: () => void;
};

/** The parcels are down: the department has to count them, the round goes on. */
export function DepositWaitingScreen({
  title,
  text,
  posted,
  status,
  note,
  actionLabel,
  onAction,
  onClose,
}: DepositWaitingScreenProps) {
  return (
    <Screen
      bottom={
        <DepositBottom>
          <Button onClick={onAction}>{actionLabel}</Button>
        </DepositBottom>
      }
    >
      <NavBar
        leading={
          <IconButton
            icon="x"
            label="Fermer"
            size="lg"
            iconSize={22}
            onClick={onClose}
          />
        }
        className="[&>div:first-child]:pl-0"
      />
      <span className="mx-auto mt-20 flex size-[88px] items-center justify-center rounded-full bg-fill">
        <Icon name="clock" size={40} />
      </span>
      <h1 className="mt-8 text-center text-[26px] leading-[31px] font-bold">
        {title}
      </h1>
      <p className="mx-auto mt-[9px] w-[310px] text-center text-15 text-muted">
        {text}
      </p>
      <DepositGroup
        className="mt-[54px]"
        items={[
          { icon: 'truck', title: posted.title, value: posted.value },
          {
            icon: 'clock',
            iconClassName: 'bg-orange-solid',
            title: status.title,
            value: status.value,
          },
        ]}
      />
      <p className="relative -top-px mt-[26px] text-center text-13 text-muted">
        {note}
      </p>
    </Screen>
  );
}

export function NavetteAttenteConfirmation() {
  return (
    <DepositWaitingScreen
      title="Au Studio de confirmer"
      text={
        <>
          Julie Perrin ou un collègue compte les 6 colis&nbsp;
          <br />
          sur son poste ou son iPhone.
        </>
      }
      posted={{ title: 'Posé à 10:56', value: '6 colis' }}
      status={{ title: 'Confirmation', value: 'En attente' }}
      note="Inutile d’attendre : la confirmation arrivera dans la tournée."
      actionLabel="Continuer la tournée"
    />
  );
}

export type DepositDoneScreenProps = {
  title: string;
  line: string;
  /** A count that did not match, said over the rest. */
  gap?: { title: string; description: string };
  rows: readonly { icon?: 'mail' | 'route'; title: string; value: string }[];
  progress?: { value: number; label: string };
  actionLabel: string;
  actionIcon?: boolean;
  onAction?: () => void;
};

/** The department has counted as many parcels as were announced. */
export function DepositDoneScreen({
  title,
  line,
  gap,
  rows,
  progress,
  actionLabel,
  actionIcon = true,
  onAction,
}: DepositDoneScreenProps) {
  return (
    <Screen
      bottom={
        <DepositBottom>
          <Button
            icon={actionIcon ? 'arrowRight' : undefined}
            iconSize={20}
            className="gap-2"
            onClick={onAction}
          >
            {actionLabel}
          </Button>
        </DepositBottom>
      }
    >
      <span className="mx-auto mt-[102px] flex size-[88px] items-center justify-center rounded-full bg-green-solid text-white">
        <Icon name="tick" size={44} />
      </span>
      <h1 className="mt-6 text-center text-[26px] leading-[31px] font-bold">
        {title}
      </h1>
      <p className="mt-[9px] text-center text-15 text-muted">{line}</p>
      {gap && (
        <PhoneBanner
          tone="red"
          icon="warning"
          className="mt-5"
          title={gap.title}
          description={gap.description}
          height={67}
        />
      )}
      <DepositGroup
        className="mt-10"
        items={rows.map(({ icon, title: rowTitle, value }) => ({
          icon,
          iconColor: icon === 'mail' ? ('ink' as const) : undefined,
          title: rowTitle,
          value,
        }))}
      />
      {progress && (
        <ProgressBar
          value={progress.value}
          label={progress.label}
          className="mt-[26px] bg-fill-2"
        />
      )}
    </Screen>
  );
}

export function NavetteDepotConfirme() {
  return (
    <DepositDoneScreen
      title="6 colis déposés au Studio"
      line="Confirmé par Julie Perrin à 10:58"
      rows={[
        { icon: 'mail', title: 'E-mails aux salariés', value: '5 envoyés' },
        { icon: 'route', title: 'Tournée', value: '2 sur 4' },
      ]}
      progress={{ value: 0.5, label: 'Tournée' }}
      actionLabel="Aller à Finance · 5 colis"
    />
  );
}

/** The department counted one parcel short: the shuttle says which one. */
export function NavetteEcartDeclare() {
  return (
    <Screen
      bottom={
        <DepositBottom>
          <Button>Signaler · Inès Garnier</Button>
        </DepositBottom>
      }
    >
      <NavBar leading={CLOSE} className="[&>div:first-child]:pl-0" />
      <PhoneBanner
        tone="red"
        icon="warning"
        className="mt-3"
        title="Le Studio a compté 5 colis sur 6"
        description="Déclaré par Julie Perrin à 10:58."
        height={67}
      />
      <h1 className="mt-[27px] text-22 font-bold">Lequel manque ?</h1>
      <div className="mt-3.5">
        <PhoneRow
          leading={<KraftThumb />}
          title="Camille Morel"
          lines={['UPS ···0622']}
          mark={<TickMark checked={false} chevron />}
          separator
        />
        <PhoneRow
          leading={<KraftThumb />}
          title="Hugo Lefèvre"
          lines={['DHL ···7112']}
          mark={<TickMark checked={false} chevron />}
          separator
        />
        <PhoneRow
          leading={<KraftThumb />}
          title="Inès Garnier"
          lines={['FedEx ···3338']}
          mark={<TickMark />}
          separator
        />
        <PhoneRow
          leading={<KraftThumb />}
          title="Axelle Bernard"
          lines={['UPS ···2210']}
          mark={<TickMark checked={false} chevron />}
          separator
        />
        <PhoneRow
          leading={<RoundTile icon="info" />}
          title="Je ne sais pas"
          lines={['Les 6 colis passent à régulariser']}
          mark={<TickMark checked={false} chevron />}
        />
      </div>
    </Screen>
  );
}

/** A parcel left out of a count, on the shuttle's phone. */
export function NavetteColisARegulariser() {
  return (
    <Screen
      bottom={
        <DepositBottom>
          <Button icon="qr" iconSize={20} className="gap-2">
            Redéposer au Studio
          </Button>
        </DepositBottom>
      }
    >
      <NavBar
        trailing={
          <IconButton
            icon="more"
            label="Plus"
            size="lg"
            iconSize={22}
            className="-mr-0.5"
          />
        }
      />
      <h1 className="mt-3 text-30 font-bold">Inès Garnier</h1>
      <p className="mt-1 text-15 text-muted">Studio · FedEx ···3338</p>
      <PhoneBanner
        tone="red"
        icon="warning"
        className="mt-5"
        title="À régulariser"
        description="Le Studio ne l’a pas compté au dépôt de 10:56. Ni le salarié ni personne n’est prévenu tant que ce n’est pas réglé."
        height={98}
        descriptionClassName="leading-[15.6px]"
      />
      <DepositTimeline
        size="phone"
        className="mt-[26px]"
        steps={[
          { title: 'Reçu et scanné', detail: 'Aujourd’hui, 10:31, par Karim' },
          { title: 'En route vers le Studio', detail: '10:52' },
          {
            title: 'Écart au dépôt',
            detail: '10:58, déclaré par Julie Perrin',
            alert: true,
          },
        ]}
      />
      <DepositGroup
        className="mt-5"
        items={[
          {
            icon: 'package',
            iconColor: 'ink',
            title: 'Je l’ai retrouvé',
            chevron: true,
          },
          {
            icon: 'phone',
            iconClassName: 'bg-green-solid',
            title: 'Appeler le Studio',
            chevron: true,
          },
        ]}
      />
    </Screen>
  );
}
