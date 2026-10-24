import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  HomeScreenPhone,
  ParcelListPhone,
  SafariPhone,
  ShareSheetPhone,
} from '#components/phone-mockup';

/** The phones drawn on the landing page: the install guide, the parcel list. */
const meta = {
  title: 'Composants/PhoneMockup',
  component: ParcelListPhone,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof ParcelListPhone>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ListeDesColis: Story = { name: 'Liste des colis' };

export const GuideDInstallation: Story = {
  name: 'Guide d’installation',
  render: () => (
    <div className="flex gap-6 bg-site-fill p-6">
      <SafariPhone />
      <ShareSheetPhone />
      <HomeScreenPhone appName="Courrier" />
    </div>
  ),
};
