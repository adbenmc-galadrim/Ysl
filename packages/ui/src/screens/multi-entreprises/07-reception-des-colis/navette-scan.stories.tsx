import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  ScanDoublonMobile,
  ScanIllisibleMobile,
  ScanLectureMobile,
  ScanPlusieursPiecesMobile,
  ScanRecommandeMobile,
} from '#screens/multi-entreprises/07-reception-des-colis/navette-scan-screen';
import { SaisieManuelleScreen } from '#screens/reception/scan-screen';

const PAGE = 'multi-entreprises/07-reception-des-colis/reception--navette';

const meta = {
  title: 'Écrans/Multi-entreprises/07 Réception des colis/Navette · Scan',
  parameters: { layout: 'fullscreen', device: { tone: 'dark' } },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Lecture: Story = {
  name: 'Lecture · mobile',
  parameters: { reference: `${PAGE}-scan-lecture-mobile` },
  render: () => <ScanLectureMobile />,
};

export const Doublon: Story = {
  name: 'Doublon · mobile',
  parameters: { reference: `${PAGE}-scan-doublon-mobile` },
  render: () => <ScanDoublonMobile />,
};

export const EtiquetteIllisible: Story = {
  name: 'Étiquette illisible · mobile',
  parameters: { reference: `${PAGE}-scan-etiquette-illisible-mobile` },
  render: () => <ScanIllisibleMobile />,
};

export const SaisieManuelle: Story = {
  name: 'Saisie manuelle · mobile',
  parameters: { reference: `${PAGE}-saisie-manuelle-mobile` },
  render: () => (
    <SaisieManuelleScreen
      count={12}
      label={{
        carrier: 'UPS',
        recipient: 'Camille Morel',
        address: ['SAINT LAURENT, 37 RUE DE BELLECHASSE', '75007 PARIS FR'],
        tracking: '1Z E63 44W 04 9923 0622',
      }}
      value="8779 7487 33"
      hint={{ tone: 'green', text: 'Format FedEx reconnu' }}
    />
  ),
};

export const PlusieursPieces: Story = {
  name: 'Colis en plusieurs pièces · mobile',
  parameters: {
    reference: `${PAGE}-cas-particuliers-colis-en-plusieurs-pieces-mobile`,
  },
  render: () => <ScanPlusieursPiecesMobile />,
};

export const ScanRecommande: Story = {
  name: 'Scan recommandé · mobile',
  parameters: { reference: `${PAGE}-cas-particuliers-scan-recommande-mobile` },
  render: () => <ScanRecommandeMobile />,
};
