import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '#components/button';
import { PARCELS } from '#fixtures/parcels';
import { ColisScreen } from '#screens/colis/colis-screen';
import { FicheColisScreen } from '#screens/colis/fiche-colis-screen';
import { ColisEnSouffranceScreen } from '#screens/notification-zones/colis-en-souffrance-screen';
import { DestinataireSansEmailScreen } from '#screens/notification-zones/destinataire-sans-email-screen';
import {
  AbsentJusquauSheet,
  ColisPasPourMoiSheet,
  ReponseSalarieSheet,
} from '#screens/notification-zones/reponse-salarie-sheet';
import { ChoisirDestinataireScreen } from '#screens/reception/choisir-destinataire-screen';

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
      reasons={[
        'Non réclamé',
        'Refusé',
        'Destinataire parti',
        'Erreur d’adresse',
      ]}
      reason="Non réclamé"
      sender="Zalando SE, Berlin"
    />
  ),
};

/** The record of a notified parcel, behind the reply sheets. */
const NOTIFIED_RECORD = (
  <FicheColisScreen
    recipient="Hugo Lefèvre"
    place="Accessoires"
    tracking="JD01 4600 0000 7112"
    carrier="DHL"
    state={{
      icon: 'mail',
      title: 'Notifié, en attente de retrait',
      description: 'Notifié il y a 2 h',
      tone: 'blue',
    }}
    steps={[
      { label: 'Reçu', state: 'done' },
      { label: 'Notifié', state: 'current' },
      { label: 'Remis', state: 'todo' },
    ]}
    details={[
      { label: 'Expéditeur', value: 'Zalando' },
      { label: 'Retrait prévu par', value: 'Paul Mercier' },
    ]}
    history={[
      {
        id: 'r',
        title: 'A répondu : Paul Mercier passera le prendre',
        detail: 'Aujourd’hui à 10 h 42',
      },
      { id: 'n', title: 'Notifié par e-mail', detail: 'Aujourd’hui à 8 h 58' },
    ]}
    replyAction={{ label: 'Le salarié a répondu' }}
  />
);

/**
 * The agent reports in two taps what the recipient answered in their
 * mailbox (D2): no Penpot frame of its own, hence no reference.
 */
export const LeSalarieARepondu: Story = {
  name: 'Le salarié a répondu',
  render: () => (
    <ReponseSalarieSheet
      recipient="Hugo Lefèvre"
      about="DHL ···7112"
      behind={NOTIFIED_RECORD}
    />
  ),
};

export const QuelColisNEstPasLeSien: Story = {
  name: 'Quel colis n’est pas le sien',
  render: () => (
    <ColisPasPourMoiSheet
      recipient="Nora Haddad"
      parcels={[
        { id: 'a', title: 'Amazon ···4471', detail: 'Reçu à 10 h 15' },
        { id: 'b', title: 'UPS ···0622', detail: 'Reçu hier' },
      ]}
      behind={NOTIFIED_RECORD}
    />
  ),
};

export const UnCollegueVient: Story = {
  name: 'Un collègue passe le prendre',
  render: () => (
    <ChoisirDestinataireScreen
      title="Qui passe le prendre ?"
      query="paul"
      showCaret
      results={[
        {
          id: 'paul',
          initials: 'PM',
          name: 'Paul Mercier',
          detail: 'Accessoires',
          email: 'paul.mercier@example.com',
        },
      ]}
      recents={[]}
      outsideTitle="Utiliser « paul »"
      outsideDescription="Un nom hors annuaire, tel que saisi"
    />
  ),
};

export const AbsentJusquau: Story = {
  name: 'Absent jusqu’au',
  render: () => (
    <AbsentJusquauSheet
      recipient="Hugo Lefèvre"
      value="2026-11-03"
      min="2026-10-28"
      help="Relances reprises le mercredi 4 nov."
      behind={NOTIFIED_RECORD}
    />
  ),
};
