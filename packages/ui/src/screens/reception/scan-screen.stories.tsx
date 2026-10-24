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
        onDigit={(d) => setValue((v) => v + d)}
        onLetter={(l) => setValue((v) => v + l)}
        onDelete={() => setValue((v) => v.slice(0, -1))}
      />
    );
  },
};
