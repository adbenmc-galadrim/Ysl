import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { PARCELS } from '#fixtures/parcels';
import {
  ModifierColisScreen,
  type ModifierColisScreenProps,
} from '#screens/colis/modifier-colis-screen';

function Editable(props: ModifierColisScreenProps) {
  const [values, setValues] = useState(props.values);
  return (
    <ModifierColisScreen {...props} values={values} onChange={setValues} />
  );
}

const meta = {
  title: 'Écrans/05 Colis/Modifier le colis',
  component: ModifierColisScreen,
  parameters: { layout: 'fullscreen', device: { tone: 'light' } },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: (args) => <Editable {...args} />,
} satisfies Meta<typeof ModifierColisScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

const camille = PARCELS.camille;

const CARRIERS = ['Colissimo', 'Chronopost', 'DHL Express', 'FedEx', 'UPS'].map(
  (name) => ({ value: name, label: name }),
);

export const ModifierLeColis: Story = {
  name: 'Modifier le colis',
  parameters: { reference: '05-colis/colis--modifier-le-colis' },
  args: {
    recipient: `${camille.recipient}, ${camille.department}`,
    values: {
      tracking: camille.tracking,
      carrier: camille.carrier,
      sender: camille.sender,
      pieces: camille.pieces,
      piecesReceived: camille.pieces,
      note: '',
      email: '',
      service: '',
      reference: '',
      weight: '',
      location: '',
    },
    carriers: CARRIERS,
    trackingCheck: { tone: 'green', text: 'Clé de contrôle UPS valide' },
    senderHelp: 'Retenu pour les prochains colis de ce compte UPS',
    annex: false,
    onRescan: () => {},
  },
};

export const TousLesChamps: Story = {
  name: 'Tous les champs, erreurs',
  args: {
    recipient: '',
    values: {
      tracking: '1Z E63 44W 04 9923 0623',
      carrier: 'UPS',
      sender: 'Metalworks SpA',
      pieces: 3,
      piecesReceived: 2,
      note: 'Fragile',
      email: 'camille.morel@',
      service: 'UPS Standard',
      reference: 'PO-48213',
      weight: '2,4',
      location: 'Étagère B',
    },
    carriers: CARRIERS,
    trackingCheck: { tone: 'red', text: 'Clé de contrôle UPS invalide' },
    errors: {
      recipient: 'Un colis notifié garde son destinataire',
      email: 'Adresse e-mail incomplète',
    },
  },
};
