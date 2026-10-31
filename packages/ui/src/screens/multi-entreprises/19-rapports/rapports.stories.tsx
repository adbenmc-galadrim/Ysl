import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  RapportsDepartementMobile,
  RapportsDesktop,
  RapportsMobile,
} from '#screens/multi-entreprises/19-rapports/rapports-screen';


const meta = {
  title: 'Écrans/Multi-entreprises/19 Rapports/Admin entreprise · Rapports',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const RapportsOrdinateur: Story = {
  name: 'Rapports · ordinateur',
  parameters: {
    reference: 'multi-entreprises/19-rapports/rapports--admin-entreprise-rapports-ordinateur',
  },
  globals: { viewport: { value: 'landingDesktop', isRotated: false } },
  render: () => <RapportsDesktop />,
};

export const PhoneRapports: Story = {
  name: 'Rapports · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/19-rapports/rapports--admin-entreprise-rapports-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <RapportsMobile />,
};

export const UnDepartementMobile: Story = {
  name: 'Un département · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/19-rapports/rapports--admin-entreprise-rapports-un-departement-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <RapportsDepartementMobile />,
};
