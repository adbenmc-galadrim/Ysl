import type { Meta, StoryObj } from '@storybook/react-vite';

import { PhotoViewer } from '#components/photo-viewer';
import { LABEL_PHOTO_URL } from '#fixtures/label-photo';
import { PARCELS } from '#fixtures/parcels';
import { FicheColisScreen } from '#screens/colis/fiche-colis-screen';

const meta = {
  title: 'Écrans/05 Colis/Fiche colis',
  component: FicheColisScreen,
  parameters: { layout: 'fullscreen', device: { tone: 'light' } },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta<typeof FicheColisScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

const camille = PARCELS.camille;

export const ANotifier: Story = {
  name: 'À notifier',
  parameters: { reference: '05-colis/colis--fiche-colis-a-notifier' },
  args: {
    recipient: camille.recipient,
    place: camille.place,
    tracking: camille.tracking,
    carrier: camille.carrier,
    state: {
      icon: 'package',
      title: 'Reçu à 10 h 42, pas encore notifiée',
      description: 'Partira avec l’e-mail groupé du lot',
    },
    steps: [
      { label: 'Reçu', state: 'current' },
      { label: 'Notifié', state: 'todo' },
      { label: 'Remis', state: 'todo' },
    ],
    details: [
      { label: 'Expéditeur', value: camille.sender },
      { label: 'Nombre de colis', value: camille.pieces },
      { label: 'Emplacement', value: camille.shelf },
      { label: 'Note', value: 'Aucune' },
    ],
    primaryAction: 'Notifier maintenant',
  },
};

const ines = PARCELS.ines;

export const EnAttenteDeRetrait: Story = {
  name: 'En attente de retrait',
  args: {
    recipient: ines.recipient,
    place: 'Ressources humaines, 4e étage',
    tracking: '7712 9450 3338',
    carrier: ines.carrier,
    notice: {
      tone: 'orange',
      icon: 'cloud',
      title: 'Modifié sur cet iPhone, pas encore envoyé',
      description: 'Partira à la prochaine connexion',
    },
    state: {
      icon: 'mail',
      title: 'Notifiée il y a 2 h',
      description: 'En attente de retrait par le destinataire',
    },
    steps: [
      { label: 'Reçu', state: 'done' },
      { label: 'Notifié', state: 'current' },
      { label: 'Remis', state: 'todo' },
    ],
    photo: { src: LABEL_PHOTO_URL },
    details: [
      { label: 'Expéditeur', value: 'Zalando SE' },
      { label: 'Nombre de colis', value: '2 sur 3' },
      { label: 'Poids', value: '2,4 kg' },
      { label: 'Service', value: 'FedEx Priority' },
      { label: 'Emplacement', value: 'Étagère A' },
      { label: 'Note', value: 'Fragile' },
      { label: 'Reçu', value: 'Aujourd’hui à 9 h 12' },
      { label: 'Synchronisation', value: 'Non envoyé' },
    ],
    history: [
      {
        id: 'e4',
        title: 'Modifié : poids, note',
        detail: 'Aujourd’hui à 11 h 05, pas encore envoyé',
        tone: 'orange',
      },
      { id: 'e3', title: 'Notifié', detail: 'Aujourd’hui à 9 h 30' },
      {
        id: 'e2',
        title: 'Destinataire choisi',
        detail: 'Aujourd’hui à 9 h 20',
      },
      { id: 'e1', title: 'Reçu', detail: 'Aujourd’hui à 9 h 12' },
    ],
    secondaryAction: { label: 'Annuler la notification' },
  },
};

export const ACompleter: Story = {
  name: 'À compléter, photo restée sur un autre iPhone',
  args: {
    recipient: 'Destinataire inconnu',
    place: 'Nom lu sur l’étiquette : C. MOREL',
    tracking: 'XW 1234 5678 9FR',
    carrier: 'Colissimo',
    notice: {
      tone: 'red',
      icon: 'alert',
      title: 'Refusé par le serveur',
      description: 'Données invalides, à corriger sur l’appareil.',
    },
    state: {
      icon: 'alert',
      title: 'À compléter',
      description: 'Choisir le destinataire pour pouvoir le notifier',
    },
    steps: [
      { label: 'Reçu', state: 'current' },
      { label: 'Notifié', state: 'todo' },
      { label: 'Remis', state: 'todo' },
    ],
    photo: { absent: 'Photo restée sur l’iPhone qui a scanné ce colis' },
    details: [
      { label: 'Expéditeur', value: 'Inconnu' },
      { label: 'Nombre de colis', value: 1 },
      { label: 'Note', value: 'Aucune' },
    ],
    primaryAction: 'Compléter',
  },
};

export const PhotoPleinEcran: Story = {
  name: 'Photo en plein écran',
  args: {
    ...ANotifier.args,
    photo: { src: LABEL_PHOTO_URL },
    overlay: (
      <PhotoViewer
        src={LABEL_PHOTO_URL}
        alt="Photo de l’étiquette"
        onClose={() => {}}
      />
    ),
  },
};

/** A reserve was set at reception: the orange card, its photos, the way to lift it. */
export const AvecReserve: Story = {
  name: 'Avec une réserve',
  args: {
    ...ANotifier.args,
    damage: {
      title: 'Réserve : carton abîmé',
      description:
        'Coin enfoncé, emballage intérieur intact · Signalée à 10 h 44',
      photos: [
        { src: LABEL_PHOTO_URL, alt: 'Photo 1 du dommage' },
        { src: LABEL_PHOTO_URL, alt: 'Photo 2 du dommage' },
      ],
      onLift: () => {},
    },
    photo: { src: LABEL_PHOTO_URL },
    history: [
      {
        id: 'damage',
        title: 'Réserve : carton abîmé',
        detail: 'Aujourd’hui à 10 h 44',
      },
      { id: 'received', title: 'Reçu', detail: 'Aujourd’hui à 10 h 42' },
    ],
  },
};

/** The reserve came from another iPhone: its photos stayed there. */
export const ReserveAutreIphone: Story = {
  name: 'Réserve signalée sur un autre iPhone',
  args: {
    ...ANotifier.args,
    damage: {
      title: 'Réserve : mouillé',
      description: 'Signalée hier à 17 h 05',
      photosAbsent: '2 photos restées sur l’iPhone qui a signalé le dommage',
      onLift: () => {},
    },
  },
};

/** No reserve yet: the grey button under the details opens « Signaler un dommage ». */
export const SignalerUnDommage: Story = {
  name: 'Sans réserve, signaler un dommage',
  args: { ...ANotifier.args, onReportDamage: () => {} },
};

/** The label was read on this iPhone: « Voir ce qui a été lu » under the photo (YSL-59, no reference). */
export const VoirCeQuiAEteLu: Story = {
  name: 'Voir ce qui a été lu',
  args: {
    ...ANotifier.args,
    photo: { src: LABEL_PHOTO_URL },
    onShowReading: () => {},
  },
};

/** A delivered parcel: the handover as the journal keeps it (F43). */
export const Remis: Story = {
  args: {
    recipient: 'Nora Haddad',
    place: 'Studio, 2e étage',
    tracking: '0944 5566 7744 71',
    carrier: 'DPD',
    state: {
      icon: 'check',
      title: 'Remis à 11 h 20',
      description: 'À Nora Haddad, code vérifié',
    },
    steps: [
      { label: 'Reçu', state: 'done' },
      { label: 'Notifié', state: 'done' },
      { label: 'Remis', state: 'current' },
    ],
    photo: { absent: 'Photo restée sur l’iPhone qui a scanné ce colis' },
    handover: {
      items: [
        { label: 'Remis à', value: 'Nora Haddad' },
        { label: 'Retiré par', value: 'Lucas Martin' },
        { label: 'Quand', value: 'Aujourd’hui à 11 h 20' },
        { label: 'Agent', value: 'Karim Benali' },
        { label: 'Méthode', value: 'Code vérifié' },
        { label: 'Synchronisation', value: 'À jour' },
      ],
      onOpen: () => {},
    },
    details: [
      { label: 'Expéditeur', value: 'Zalando' },
      { label: 'Nombre de colis', value: 1 },
      { label: 'Note', value: 'Aucune' },
    ],
    history: [
      {
        id: 'e2',
        title: 'Remis à Nora Haddad par Karim (code vérifié)',
        detail: 'Aujourd’hui à 11 h 20',
      },
      { id: 'e1', title: 'Reçu', detail: 'Hier à 9 h 12' },
    ],
  },
};
