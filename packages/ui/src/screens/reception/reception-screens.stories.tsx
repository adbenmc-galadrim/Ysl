import type { Meta, StoryObj } from '@storybook/react-vite';

import { DIRECTORY, RECEPTION_BATCH, UNCERTAIN_LABEL } from '#fixtures/reception';
import { ChoisirDestinataireScreen } from '#screens/reception/choisir-destinataire-screen';
import { LotEnregistreScreen } from '#screens/reception/lot-enregistre-screen';
import { RevueLotScreen } from '#screens/reception/revue-lot-screen';
import { VerifierColisScreen } from '#screens/reception/verifier-colis-screen';

/**
 * After the burst: review the batch, fix what the scanner doubted, save.
 * Four screens of one flow, so one file; each story renders its own screen.
 */
const meta = {
  title: 'Écrans/04 Réception/Après le scan',
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'light' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta;

export default meta;

type Story = StoryObj;

export const RevueDuLot: Story = {
  name: 'Revue du lot',
  parameters: {
    reference: '04-reception/reception-scan-en-rafale--revue-du-lot',
  },
  render: () => (
    <RevueLotScreen
      count={RECEPTION_BATCH.count}
      summary="12 colis lus. Deux demandent votre avis, les autres sont prêts."
      toCheck={RECEPTION_BATCH.toCheck}
      ready={RECEPTION_BATCH.ready}
      readyCount={RECEPTION_BATCH.readyCount}
    />
  ),
};

export const VerifierUnColis: Story = {
  name: 'Vérifier un colis',
  parameters: {
    reference: '04-reception/reception-scan-en-rafale--verifier-un-colis',
  },
  render: () => (
    <VerifierColisScreen
      step={{ index: 1, total: 2 }}
      label={{
        heading: UNCERTAIN_LABEL.heading,
        name: UNCERTAIN_LABEL.name,
        address: UNCERTAIN_LABEL.address,
        glare: { left: 106, width: 90 },
      }}
      readName={UNCERTAIN_LABEL.name}
      candidates={[DIRECTORY.lea, DIRECTORY.lise, DIRECTORY.louis]}
      selectedId={DIRECTORY.lea.id}
      fields={[
        { label: 'Transporteur', value: UNCERTAIN_LABEL.carrier },
        { label: 'Suivi', value: UNCERTAIN_LABEL.tracking, mono: true },
      ]}
    />
  ),
};

export const ChoisirLeDestinataire: Story = {
  name: 'Choisir le destinataire',
  parameters: {
    reference:
      '04-reception/reception-scan-en-rafale--choisir-le-destinataire',
  },
  render: () => (
    <ChoisirDestinataireScreen
      query="fonta"
      showCaret
      results={[DIRECTORY.lea, DIRECTORY.louis, DIRECTORY.lise]}
      recents={[DIRECTORY.nora, DIRECTORY.hugo]}
    />
  ),
};

export const LotEnregistre: Story = {
  name: 'Lot enregistré',
  parameters: {
    reference: '04-reception/reception-scan-en-rafale--lot-enregistre',
  },
  render: () => (
    <LotEnregistreScreen
      count={RECEPTION_BATCH.count}
      span={`Lot de ${RECEPTION_BATCH.startedAt} à ${RECEPTION_BATCH.endedAt}`}
      emails={9}
      outcomes={[
        {
          icon: 'mail',
          tone: 'blue',
          title: '9 e-mails prêts',
          detail: '11 colis pour 9 personnes',
        },
        {
          icon: 'alert',
          tone: 'red',
          title: '1 à compléter',
          detail: 'Rangé dans À compléter, non notifié',
        },
        {
          icon: 'wifiOff',
          tone: 'grey',
          title: 'Hors ligne',
          detail: 'Les e-mails partiront au retour du réseau',
        },
      ]}
    />
  ),
};
