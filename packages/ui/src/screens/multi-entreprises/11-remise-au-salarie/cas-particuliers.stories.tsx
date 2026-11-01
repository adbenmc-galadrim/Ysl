import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  QuiRetireMobile,
  RetireParCollegueMobile,
} from '#screens/multi-entreprises/11-remise-au-salarie/cas-particuliers-screen';
import { PARCELS } from '#fixtures/parcels';
import { AnnulerRemiseScreen } from '#screens/remise/annuler-remise-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/11 Remise au salarié/Cas particuliers',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const QuiRetire: Story = {
  name: 'Qui retire ? · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/11-remise-au-salarie/remise--departement-cas-particuliers-qui-retire-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <QuiRetireMobile />,
};

export const RetireParUnCollegue: Story = {
  name: 'Retiré par un collègue · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/11-remise-au-salarie/remise--departement-cas-particuliers-retire-par-un-collegue-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <RetireParCollegueMobile />,
};

export const AnnulerUneRemise: Story = {
  name: 'Annuler une remise · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/11-remise-au-salarie/remise--departement-cas-particuliers-annuler-une-remise-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => (
    <AnnulerRemiseScreen
      parcel={PARCELS.malik}
      handedOver="Remis hier à 9 h 12"
      proof="À Malik Benali, QR code vérifié, par Karim"
      reason="wrong_parcel"
      note="Le colis remis était celui de M. Bernard"
    />
  ),
};
