import type { Meta, StoryObj } from '@storybook/react-vite';

import { QrCode } from '#components/qr-code';
import {
  Barcode,
  LabelZoom,
  LabelZoomButton,
  ParcelBox,
  ParcelLabel,
} from '#components/parcel-label';
import { SCANNED_LABEL, UNCERTAIN_LABEL } from '#fixtures/reception';

const meta = {
  title: 'Composants/ParcelLabel',
  component: ParcelLabel,
  parameters: { layout: 'centered' },
  args: SCANNED_LABEL,
} satisfies Meta<typeof ParcelLabel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Etiquette: Story = { name: 'Étiquette' };

/** As the camera frames it: the label on the kraft side of the box. */
export const SurLeColis: Story = {
  name: 'Sur le colis',
  render: (args) => (
    <ParcelBox>
      <ParcelLabel {...args} />
    </ParcelBox>
  ),
};

/** Another carrier, another addressee: everything printed is a prop. */
export const AutreTransporteur: Story = {
  name: 'Autre transporteur',
  args: {
    carrier: 'DHL',
    recipient: 'Hugo Lefèvre',
    address: ['SAINT LAURENT, 37 RUE DE BELLECHASSE', '75007 PARIS FR'],
    tracking: '00 3403 7112 4471 7112',
  },
};

/** The corner code is a slot: a scannable QR code drops in. */
export const AvecQrCode: Story = {
  name: 'Avec un QR code',
  args: {
    code: (
      <QrCode
        module={3.8}
        className="p-0"
        matrix={[
          '#######.#.#######',
          '#.....#..##.....#',
          '#.###.#.#.#.###.#',
          '#.###.#..##.###.#',
          '#.###.#.#.#.###.#',
          '#.....#.##......#',
          '#######.#.#######',
          '........##.......',
          '#.#.###.#.##.#.##',
          '.##..#.##.#..##..',
          '#######..#.#.#.##',
          '#.....#.##..#.#..',
          '#.###.#..#.##.###',
          '#.###.#.##..#..#.',
          '#.###.#.#.##.#.##',
          '#.....#..#..##.#.',
          '#######.##.#.#.##',
        ]}
      />
    ),
  },
};

export const CodeBarre: Story = {
  name: 'Code-barres',
  render: () => <Barcode />,
};

/** The close-up of a doubtful name, on the parcel check screen. */
export const Zoom: Story = {
  render: () => (
    <LabelZoom
      heading={UNCERTAIN_LABEL.heading}
      name={UNCERTAIN_LABEL.name}
      address={UNCERTAIN_LABEL.address}
      glare={{ left: 106, width: 90 }}
      action={<LabelZoomButton />}
      className="w-[353px]"
    />
  ),
};
