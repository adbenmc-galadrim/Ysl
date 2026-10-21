import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '#components/button';
import { PARCELS } from '#fixtures/parcels';
import { ColisScreen } from '#screens/colis/colis-screen';
import { ColisEnSouffranceScreen } from '#screens/notification-zones/colis-en-souffrance-screen';
import { DestinataireSansEmailScreen } from '#screens/notification-zones/destinataire-sans-email-screen';

const meta = {
  title: 'Écrans/09 Zones d’ombre/Notification et suivi',
  parameters: { layout: 'fullscreen', device: { tone: 'light' } },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/** The home list, with the recipients' answers to the e-mail on top. */
export const ReponsesDesSalaries: Story = {
  name: 'Réponses des salariés',
  parameters: {
    reference: '09-zones-d-ombre/notification-et-suivi--reponses-des-salaries',
  },
  render: () => (
    <ColisScreen
      sync="synced"
      summary="18 colis, dont 8 à traiter"
      sections={[
        {
          title: 'Réponses des salariés',
          parcels: [PARCELS.hugoNotMine, PARCELS.noraDelegated],
          rowAction: (parcel) =>
            parcel.reply?.kind === 'notMine' ? (
              <Button variant="danger" size="xs" className="w-[112px]">
                Réattribuer
              </Button>
            ) : undefined,
        },
        {
          title: 'À notifier',
          parcels: [PARCELS.camille],
          action: (
            <Button size="xs" className="w-[84px]">
              Notifier
            </Button>
          ),
        },
        {
          title: 'En attente de retrait',
          parcels: [PARCELS.ines, PARCELS.hugo, PARCELS.nora],
        },
      ]}
    />
  ),
};

export const DestinataireSansEmail: Story = {
  name: 'Destinataire sans e-mail',
  parameters: {
    reference:
      '09-zones-d-ombre/notification-et-suivi--destinataire-sans-e-mail',
  },
  render: () => (
    <DestinataireSansEmailScreen
      recipient={PARCELS.marc.recipient}
      place={PARCELS.marc.place}
      progress="2 sur 2"
      way="email"
      email="marc.petit@prestataire.fr"
    />
  ),
};

export const ColisEnSouffrance: Story = {
  name: 'Colis en souffrance',
  parameters: {
    reference: '09-zones-d-ombre/notification-et-suivi--colis-en-souffrance',
  },
  render: () => (
    <ColisEnSouffranceScreen
      recipient={PARCELS.ines.recipient}
      detail={`${PARCELS.ines.department}, ${PARCELS.ines.carrier} ···${PARCELS.ines.last4}`}
      carrier={PARCELS.ines.carrier}
      waiting="En attente depuis 8 jours"
      reminders="Deux relances sans réponse."
      reasons={['Non réclamé', 'Refusé', 'Destinataire parti', 'Erreur d’adresse']}
      reason="Non réclamé"
      sender="Zalando SE, Berlin"
    />
  ),
};
