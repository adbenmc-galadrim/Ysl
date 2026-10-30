import type { Meta, StoryObj } from '@storybook/react-vite';

import { LabelThumb } from '#components/label-thumb';
import { ColisScreen } from '#screens/colis/colis-screen';
import { Accueil } from '#screens/colis/colis-screen.stories';
import {
  ChoisirDestinataireMobile,
  LotEnRouteMobile,
  RevueLotMobile,
} from '#screens/multi-entreprises/07-reception-des-colis/navette-lot-screen';
import { ColisAbimeScreen } from '#screens/reception-zones/colis-abime-screen';
import { ReprendreLotScreen } from '#screens/reception-zones/reprendre-lot-screen';

const PAGE = 'multi-entreprises/07-reception-des-colis/reception--navette';

const meta = {
  title: 'Écrans/Multi-entreprises/07 Réception des colis/Navette · Lot',
  parameters: { layout: 'fullscreen', device: { tone: 'light' } },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const RevueDuLot: Story = {
  name: 'Revue du lot · départements · mobile',
  parameters: { reference: `${PAGE}-revue-du-lot-departements-mobile` },
  render: () => <RevueLotMobile />,
};

export const ChoisirDestinataire: Story = {
  name: 'Choisir le destinataire · mobile',
  parameters: { reference: `${PAGE}-choisir-le-destinataire-mobile` },
  render: () => <ChoisirDestinataireMobile queryRaised />,
};

export const LotEnRoute: Story = {
  name: 'Lot enregistré · en route · mobile',
  parameters: { reference: `${PAGE}-lot-enregistre-en-route-mobile` },
  render: () => <LotEnRouteMobile />,
};

export const ColisAbime: Story = {
  name: 'Colis abîmé · mobile',
  parameters: { reference: `${PAGE}-cas-particuliers-colis-abime-mobile` },
  render: () => (
    <div className="h-full [&_[role=group]>button:nth-child(1)]:w-[124.4px] [&_[role=group]>button:nth-child(2)]:w-[78.2px] [&_[role=group]>button:nth-child(3)]:w-[85.9px] [&_[role=group]>button:nth-child(4)]:w-[132.1px] [&_[role=group]>button:nth-child(5)]:w-[70.5px]">
      <ColisAbimeScreen
        parcel={{ recipient: 'Inès Garnier', carrier: 'FedEx', last4: '3338' }}
        reasons={['Carton abîmé', 'Ouvert', 'Mouillé', 'Contenu cassé', 'Autre']}
        reason="Carton abîmé"
        photos={<LabelThumb width={104} height={104} radius={14} tone="deep" />}
        remark="Coin enfoncé, emballage intérieur intact"
        notifyRecipient
        carrierReserve={false}
      />
    </div>
  ),
};

export const ReprendreLeLot: Story = {
  name: 'Reprendre le lot · mobile',
  parameters: { reference: `${PAGE}-cas-particuliers-reprendre-le-lot-mobile` },
  render: () => (
    <div className="h-full [&_ul]:grid-cols-[repeat(6,52px)]">
      <ReprendreLotScreen
        behind={<ColisScreen {...Accueil.args} />}
        startedAt="de 10 h 31"
        parcels={['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => ({ id }))}
        thumbnail={(_, i) => (
          <LabelThumb
            width={52}
            height={64}
            radius={8}
            tone={i % 2 ? 'light' : 'mid'}
            className="h-auto w-full"
          />
        )}
      />
    </div>
  ),
};
