import type { Meta, StoryObj } from '@storybook/react-vite';

import { LABEL_PHOTO_URL } from '#fixtures/label-photo';
import {
  LectureScreen,
  type LectureField,
} from '#screens/colis/lecture-screen';

/**
 * No Penpot mockup for this screen (YSL-59): it follows the record and the
 * Réglages screens, and its stories have no reference to compare against.
 */
const meta = {
  title: 'Écrans/05 Colis/Ce qui a été lu',
  component: LectureScreen,
  parameters: { layout: 'fullscreen', device: { tone: 'light' } },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta<typeof LectureScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

const DHL = '5413337112';

const FIELDS: LectureField[] = [
  {
    id: 'champ-tracking',
    label: 'Suivi',
    value: '54 1333 7112',
    mono: true,
    status: 'warning',
    statusLabel: 'À vérifier',
    confidence: '0,89',
    sources: [
      {
        rank: '4',
        label: 'Code 1D Code128, format sans clé',
        value: DHL,
        confidence: '0,85',
      },
      {
        rank: '6',
        label: 'Texte imprimé, format sans clé',
        value: DHL,
        confidence: '0,65',
      },
    ],
    adjustments: [
      { label: 'Concordance de 2 sources', delta: '+0,10' },
      { label: 'Plafond sans clé de contrôle (0,89)', delta: '−0,06' },
    ],
    note: 'Aucune clé de contrôle ne garantit ce numéro : il reste « à vérifier » même lu deux fois.',
  },
  {
    id: 'champ-carrier',
    label: 'Transporteur',
    value: 'DHL Express',
    status: 'ok',
    statusLabel: 'Lu',
    confidence: '0,93',
    sources: [
      {
        rank: '3',
        label: 'Déduit du code Code128',
        value: 'DHL',
        confidence: '0,93',
      },
    ],
    adjustments: [],
  },
  {
    id: 'champ-recipient',
    label: 'Destinataire',
    value: 'Camille Morel',
    status: 'warning',
    statusLabel: 'À vérifier',
    confidence: '0,82',
    sources: [
      {
        rank: '1',
        label: 'Code 2D Aztec',
        value: 'CAMILLE MOREL',
        confidence: '0,97',
      },
    ],
    adjustments: [{ label: 'Contradiction entre sources', delta: '−0,15' }],
    others: [{ value: 'JEAN DUPUIS', confidence: '0,65' }],
  },
];

export const Lecture: Story = {
  args: {
    subtitle: 'Lu le 20 oct. à 9 h 00 sur cet iPhone',
    photo: { src: LABEL_PHOTO_URL, alt: 'Photo de l’étiquette' },
    fields: FIELDS,
    codes: [
      {
        format: 'Code128',
        text: DHL,
        parser: 'Numéro DHL Express',
        recognized: true,
      },
      {
        format: 'DataMatrix',
        text: 'XQ4·9P2·A7',
        parser: 'Non reconnu',
        recognized: false,
      },
    ],
    lines: [
      { text: 'DHL EXPRESS' },
      { text: 'SHIP TO', mark: 'Destinataire' },
      { text: 'JEAN DUPUIS', mark: 'Destinataire' },
      { text: '24 RUE DE BELLECHASSE' },
      { text: '75007 PARIS' },
      { text: `WAYBILL ${DHL}`, mark: 'Suivi' },
    ],
    facts: [
      { label: 'Codes', value: '120 ms' },
      { label: 'Texte', value: '900 ms' },
      { label: 'Fusion', value: '3 ms' },
      { label: 'Version des règles', value: '1' },
    ],
    copy: { label: 'Copier le diagnostic' },
  },
};

/** Opened from « D'où vient cette valeur ? » on the recipient. */
export const SurUnChamp: Story = {
  name: 'Sur un champ',
  args: { ...Lecture.args, focus: 'champ-recipient' },
};

export const Copie: Story = {
  args: {
    ...Lecture.args,
    copy: { label: 'Copier', done: 'Diagnostic copié' },
  },
};

export const PasDeLecture: Story = {
  name: 'Pas de lecture',
  args: {
    empty: {
      icon: 'scan',
      title: 'Pas de lecture enregistrée',
      description:
        'Ce colis a été importé ou saisi à la main : aucune étiquette n’a été lue.',
    },
  },
};

export const Purgee: Story = {
  name: 'Lecture purgée',
  args: {
    empty: {
      icon: 'clock',
      title: 'Lecture purgée',
      description:
        'Ce qui a été lu sur l’étiquette est effacé de l’iPhone 30 jours après la réception.',
    },
  },
};
