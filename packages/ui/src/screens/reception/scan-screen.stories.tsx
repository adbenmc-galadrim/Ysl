import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { SCANNED_LABEL } from '#fixtures/reception';
import {
  SaisieManuelleScreen,
  ScanScreen,
} from '#screens/reception/scan-screen';

const meta = {
  title: 'Écrans/04 Réception/Scan en rafale',
  component: ScanScreen,
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'dark' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  args: { count: 12, label: SCANNED_LABEL },
} satisfies Meta<typeof ScanScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Lecture: Story = {
  parameters: {
    reference: '04-reception/reception-scan-en-rafale--scan-lecture',
  },
  args: {
    onUndo: () => undefined,
    reading: {
      kind: 'read',
      last: { name: 'Hugo Lefèvre', meta: 'DHL ···7112' },
      fields: [
        { label: 'Transporteur', value: 'UPS' },
        { label: 'Suivi', value: SCANNED_LABEL.tracking, mono: true },
        { label: 'Destinataire', value: 'Camille Morel ?', status: 'warning' },
      ],
    },
  },
};

/** No one named on the label: the previous parcel's recipient is one tap away (F11). */
export const LectureMemeDestinataire: Story = {
  name: 'Lecture, même destinataire',
  args: {
    onUndo: () => undefined,
    reading: {
      kind: 'read',
      last: { name: 'Camille Morel', meta: 'UPS ···0622' },
      fields: [
        { label: 'Transporteur', value: 'UPS' },
        { label: 'Suivi', value: '1Z E63 44W 04 9923 0641', mono: true },
        { label: 'Destinataire', value: 'Non lu', status: 'warning' },
      ],
      action: { label: 'Même destinataire que le précédent' },
    },
  },
};

/** The instant the codes come back: the corners turn green and the picture flashes green, then the screen settles on "Lecture". */
export const LectureConfirmee: Story = {
  name: 'Lecture confirmée',
  args: { ...Lecture.args, flash: true },
};

/** Right after the tap: the band says the reading is on its way. */
export const LectureEnCours: Story = {
  name: 'Lecture en cours',
  args: {
    count: 13,
    onUndo: () => undefined,
    reading: {
      kind: 'read',
      fields: [],
      last: { name: 'Destinataire inconnu', meta: 'Lecture…' },
    },
  },
};

/** The photo was kept although nothing could be read: the band says so; here the app no longer offers "Annuler". */
export const DernierNonLu: Story = {
  name: 'Dernier non lu',
  args: {
    count: 13,
    reading: {
      kind: 'read',
      fields: [],
      last: { name: 'Destinataire inconnu', meta: 'Non lu', status: 'error' },
    },
  },
};

export const Doublon: Story = {
  parameters: {
    reference: '04-reception/reception-scan-en-rafale--scan-doublon',
  },
  args: {
    reading: {
      kind: 'duplicate',
      title: 'Déjà dans ce lot',
      detail: 'Camille Morel, UPS ···0622, scanné à 10 h 42',
      message: 'Ce colis n’a pas été ajouté une deuxième fois.',
    },
  },
};

/** The same label was received in an earlier batch: the title says when. */
export const DoublonLotAnterieur: Story = {
  name: 'Doublon, lot antérieur',
  args: {
    reading: {
      kind: 'duplicate',
      title: 'Déjà reçu le 23 octobre',
      detail: 'Camille Morel, UPS ···0622, reçu à 10 h 42',
      message: 'Ce colis n’a pas été ajouté une deuxième fois.',
    },
  },
};

export const EtiquetteIllisible: Story = {
  name: 'Étiquette illisible',
  parameters: {
    reference:
      '04-reception/reception-scan-en-rafale--scan-etiquette-illisible',
  },
  args: {
    reading: {
      kind: 'unreadable',
      title: 'Numéro de suivi introuvable',
      hint: 'Reflet sur l’étiquette. Inclinez légèrement le colis.',
    },
  },
};

/** Black until the first frame, so nothing flashes under the overlays. */
export const Activation: Story = {
  args: {
    count: 0,
    label: undefined,
    reading: { kind: 'starting', title: 'Activation…' },
  },
};

/** iOS refused the camera: ask again, or fall back to the gallery. */
export const CameraBloquee: Story = {
  name: 'Caméra bloquée',
  args: {
    count: 0,
    label: undefined,
    reading: {
      kind: 'blocked',
      title: 'iOS a bloqué la caméra',
      hint: 'Réessayez, ou importez une photo de l’étiquette.',
    },
  },
};

/** The keyboard square of the camera opens this sheet. */
export const SaisieManuelle: StoryObj<typeof SaisieManuelleScreen> = {
  name: 'Saisie manuelle',
  parameters: {
    reference: '04-reception/reception-scan-en-rafale--saisie-manuelle',
  },
  render: () => (
    <SaisieManuelleScreen
      count={12}
      label={SCANNED_LABEL}
      value="8779 7487 33"
      hint={{ tone: 'green', text: 'Format FedEx reconnu' }}
      onLetter={() => undefined}
    />
  ),
};

/** The "ABC" key swaps the digits for the letters a tracking number needs. */
export const SaisieManuelleLettres: StoryObj<typeof SaisieManuelleScreen> = {
  name: 'Saisie manuelle, lettres',
  render: () => {
    const [value, setValue] = useState('1ZE6');
    return (
      <SaisieManuelleScreen
        count={12}
        label={SCANNED_LABEL}
        value={value.replace(/(.{4})(?=.)/g, '$1 ')}
        letters
        onDigit={(d) => setValue((v) => v + d)}
        onLetter={(l) => setValue((v) => v + l)}
        onDelete={() => setValue((v) => v.slice(0, -1))}
      />
    );
  },
};
