import type { ReactNode } from 'react';

import { Button } from '#components/button';
import { CameraTool, CameraTopBar, ShutterButton } from '#components/camera-controls';
import {
  CameraNotice,
  CameraNoticeButton,
  CameraPanel,
  LastScanPanel,
} from '#components/camera-panel';
import {
  CameraViewport,
  Viewfinder,
  type ViewfinderTone,
} from '#components/camera-viewport';
import { IconButton } from '#components/icon-button';
import { ParcelBox, ParcelLabel, type ParcelLabelProps } from '#components/parcel-label';
import { PieceDots } from '#components/piece-dots';
import { ScanFields } from '#components/scan-fields';
import { SegmentedControl } from '#components/segmented-control';
import { Icon } from '#icons';

const UPS_LABEL: ParcelLabelProps = {
  carrier: 'UPS',
  recipient: 'Camille Morel',
  address: ['SAINT LAURENT, 37 RUE DE BELLECHASSE', '75007 PARIS FR'],
  tracking: '1Z E63 44W 04 9923 0622',
};

const REGISTERED_LABEL: ParcelLabelProps = {
  carrier: 'LA POSTE',
  recipient: 'Direction juridique',
  address: ['SAINT LAURENT, 37 RUE DE BELLECHASSE', '75007 PARIS FR'],
  recipientHeading: 'DESTINATAIRE',
  trackingHeading: 'RECOMMANDÉ AVEC AR ',
  tracking: '1A 123 456 7890 1',
};

function Subject({
  label,
  tone,
  dim,
  envelope = false,
}: {
  label: ParcelLabelProps;
  tone: ViewfinderTone;
  dim?: boolean;
  envelope?: boolean;
}) {
  return (
    <div className="relative h-[370px] w-[393px]">
      <div className="absolute left-12 translate-x-[0.5px]">
        <ParcelBox tone={envelope ? 'envelope' : 'kraft'}>
          <ParcelLabel {...label} className="bg-scan-paper" />
        </ParcelBox>
      </div>
      {dim && (
        <div className="absolute -top-[190px] left-0 h-[852px] w-[393px] bg-black/25" />
      )}
      <div className="absolute top-1.5 left-[60px] translate-x-[0.5px]">
        <Viewfinder tone={tone} />
      </div>
    </div>
  );
}

function Controls({ count }: { count: number }) {
  return (
    <div className="flex shrink-0 flex-col px-5">
      <div className="flex h-11 justify-between">
        <CameraTool icon="image" label="Importer une photo" />
        <CameraTool icon="keyboard" label="Saisir le numéro" />
      </div>
      <div className="mt-[22px] flex h-[76px] items-center">
        <button
          type="button"
          aria-label={`${count} colis lus, voir la liste`}
          className="flex h-[52px] w-[104px] items-center gap-2 rounded-button bg-night pl-[18px] text-16 font-semibold"
        >
          <Icon name="list" size={20} />
          <span className="relative -top-px w-10 text-center">{count}</span>
        </button>
        <ShutterButton className="ml-[34px]" />
        <Button
          variant="light"
          className="ml-auto w-[104px] px-0 pb-[3px] text-16"
        >
          Terminer
        </Button>
      </div>
    </div>
  );
}

function CameraScene({
  count,
  label,
  tone = 'idle',
  dim,
  envelope,
  children,
}: {
  count: number;
  label: ParcelLabelProps;
  tone?: ViewfinderTone;
  dim?: boolean;
  envelope?: boolean;
  children: ReactNode;
}) {
  return (
    <CameraViewport
      frame={false}
      subject={<Subject label={label} tone={tone} dim={dim} envelope={envelope} />}
    >
      <CameraTopBar
        title={
          <span className="block w-[93px] text-center">
            Lot : {count} colis
          </span>
        }
      />
      {children}
      <Controls count={count} />
    </CameraViewport>
  );
}

/** A label already in the batch: the yellow frame, and what to do about it. */
export function ScanDoublonMobile() {
  return (
    <CameraScene count={12} label={UPS_LABEL} tone="warning">
      <CameraNotice
        tone="warning"
        icon="alert"
        title="Déjà dans ce lot"
        className="mx-4 mt-3.5 h-[78px]"
      >
        <span className="relative -top-px">
          Camille Morel, UPS ···0622, scanné à 10 h 42
        </span>
      </CameraNotice>
      <div className="flex-1" />
      <CameraNotice
        className="mx-4 h-[98px]"
        actions={
          <>
            <CameraNoticeButton className="w-40 pb-[5px]">
              Voir le colis
            </CameraNoticeButton>
            <CameraNoticeButton className="w-40 pb-[5px]">
              Ajouter quand même
            </CameraNoticeButton>
          </>
        }
      >
        Ce colis n’a pas été ajouté une deuxième fois.
      </CameraNotice>
    </CameraScene>
  );
}

/** Nothing usable on the label: the red frame and the two ways out. */
export function ScanIllisibleMobile() {
  return (
    <CameraScene count={12} label={UPS_LABEL} tone="error" dim>
      <div className="flex-1" />
      <CameraNotice
        tone="danger"
        icon="alert"
        title="Numéro de suivi introuvable"
        className="mx-4 h-[110px]"
        actions={
          <>
            <CameraNoticeButton className="w-40 pb-[5px]">
              Saisir le numéro
            </CameraNoticeButton>
            <CameraNoticeButton className="w-40 pb-[5px]">
              Garder la photo
            </CameraNoticeButton>
          </>
        }
      >
        <span className="relative -top-px">
          Reflet sur l’étiquette. Inclinez légèrement le colis.
        </span>
      </CameraNotice>
    </CameraScene>
  );
}

/** The second box of a parcel in three: gathered, the third still missing. */
export function ScanPlusieursPiecesMobile() {
  return (
    <CameraScene count={12} label={UPS_LABEL}>
      <LastScanPanel
        className="mx-4 mt-3.5"
        caption="Colis en 3 pièces"
        title="Camille Morel"
        meta={<span className="relative -top-px">UPS ···0622</span>}
        trailing={<PieceDots total={3} read={[1, 2]} />}
      />
      <div className="flex-1" />
      <CameraPanel className="mx-4 h-[110px] shrink-0 px-4 pt-3.5">
        <p className="text-16 font-semibold">Pièce 2 sur 3 lue</p>
        <p className="relative -top-px mt-[5px] text-14 text-night-muted">
          Même numéro : pièces regroupées en un colis.
        </p>
        <CameraNoticeButton className="mt-[13px] h-[30px] w-full pb-1 text-13">
          La 3e pièce manque : enregistrer 2 sur 3
        </CameraNoticeButton>
      </CameraPanel>
    </CameraScene>
  );
}

/** Registered mail through the same scanner: number, sender, department. */
export function ScanRecommandeMobile() {
  return (
    <CameraScene count={4} label={REGISTERED_LABEL} envelope>
      <SegmentedControl
        tone="night"
        label="Type d’envoi"
        options={['Colis', 'Recommandé', 'Courrier']}
        value="Recommandé"
        className="mx-auto mt-3 h-10 w-[301px] rounded-[20px] [&>button]:pb-[3px]"
      />
      <div className="flex-1" />
      <CameraPanel className="mx-4 h-[126px] shrink-0 px-4 pt-3.5">
        <p className="relative -top-px text-14 font-semibold">
          Lettre recommandée avec avis de réception
        </p>
        <ScanFields
          className="mt-2.5 gap-[9px] [&_dd>span]:relative [&_dd>span]:-top-px [&_dt]:relative [&_dt]:-top-px [&_dt]:w-[90px]"
          fields={[
            { label: 'N°', value: '1A 123 456 7890 1', mono: true },
            { label: 'Expéditeur', value: <span>URSSAF Île-de-France</span> },
            {
              label: 'Pour',
              value: <span>Direction juridique ?</span>,
              status: 'warning',
            },
          ]}
        />
      </CameraPanel>
    </CameraScene>
  );
}

function At({
  x,
  y,
  className,
  children,
}: {
  x: number;
  y: number;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span className={`absolute ${className ?? ''}`} style={{ left: x, top: y }}>
      {children}
    </span>
  );
}

function ReadingLine({
  y,
  label,
  mono,
  children,
}: {
  y: number;
  label: string;
  mono?: boolean;
  children: string;
}) {
  return (
    <>
      <At x={14} y={y + 1} className="text-ios-green-dark">
        <Icon name="check" size={16} className="block" />
      </At>
      <At x={40} y={y - 1} className="text-14 text-night-muted">
        {label}
      </At>
      <At x={140} y={mono ? y : y - 1} className={mono ? 'font-mono text-14' : 'text-14'}>
        {children}
      </At>
    </>
  );
}

/** The first reading of a label: what was read, and the parcel added before. */
export function ScanLectureMobile() {
  return (
    <div
      data-tone="camera"
      className="relative h-[852px] w-full overflow-hidden bg-scan-desk text-white"
    >
      <div className="absolute inset-x-0 top-0 h-[520px] bg-scene" />
      <div className="absolute inset-x-0 top-0 h-[98px] bg-linear-to-b from-black/100 from-50% to-transparent" />
      <IconButton
        icon="x"
        label="Fermer"
        size="lg"
        iconSize={22}
        className="absolute top-14 left-[18px] bg-night-2 text-white"
      />
      <IconButton
        icon="torch"
        label="Lampe"
        size="lg"
        iconSize={22}
        className="absolute top-14 left-[331px] bg-night-2 text-white"
      />
      <span className="absolute top-[58px] left-[136px] flex h-10 w-[120px] items-center justify-center rounded-[20px] bg-night-2 pb-px text-15 font-semibold">
        Lot : 12 colis
      </span>
      <div className="absolute top-28 left-5 h-16 w-[353px] rounded-panel bg-night">
        <At x={14} y={10} className="text-12 text-night-muted">
          Dernier ajouté
        </At>
        <At x={14} y={30} className="text-16 font-semibold">
          Hugo Lefèvre
        </At>
        <At x={124} y={33} className="text-night-muted">
          <Icon name="building" size={14} className="block" />
        </At>
        <At x={142} y={30} className="text-14 text-night-muted">
          Studio
        </At>
        <At x={270} y={22}>
          <Icon name="undo" size={18} className="block" />
        </At>
        <At x={292} y={22} className="text-15">
          Annuler
        </At>
      </div>
      <div className="absolute top-[200px] left-14 h-[330px] w-[280px] rounded-[8px] bg-kraft">
        <div className="absolute top-6 left-5 h-[250px] w-60 rounded-[4px] bg-paper text-label-ink">
          <At x={14} y={12} className="font-label text-20 font-bold">
            UPS
          </At>
          <At x={14} y={98} className="text-[9px] font-bold">
            SHIP TO:
          </At>
          <At x={14} y={114} className="font-label text-15 font-bold">
            CAMILLE MOREL
          </At>
          <At x={14} y={180} className="h-[50px] w-[212px] bg-label-ink" />
        </div>
      </div>
      <div className="absolute top-[190px] left-[46px] h-[300px] w-[300px]">
        <Viewfinder className="h-[300px]! w-[300px]! [&>span]:size-8!" />
      </div>
      <div className="absolute top-[556px] left-5 h-[120px] w-[353px] rounded-panel bg-night">
        <ReadingLine y={15} label="Transporteur">
          UPS
        </ReadingLine>
        <ReadingLine y={47} label="Suivi" mono>
          1Z E63 44W 04 9923 0622
        </ReadingLine>
        <ReadingLine y={79} label="Destinataire">
          Camille Morel · Studio
        </ReadingLine>
      </div>
      <ShutterButton className="absolute top-[698px] left-[154px] size-[84px] [&>span]:size-16" />
      <Button
        variant="light"
        className="absolute top-[716px] left-[271px] h-12 w-[102px] rounded-[24px] px-0 text-16"
      >
        Terminer
      </Button>
    </div>
  );
}
