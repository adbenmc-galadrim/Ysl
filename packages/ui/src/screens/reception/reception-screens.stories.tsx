import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  DIRECTORY,
  type DirectoryEntry,
  RECEPTION_BATCH,
  UNCERTAIN_LABEL,
  whereabouts,
} from '#fixtures/reception';
import { ChoisirDestinataireScreen } from '#screens/reception/choisir-destinataire-screen';
import { LotEnregistreScreen } from '#screens/reception/lot-enregistre-screen';
import { RevueLotScreen } from '#screens/reception/revue-lot-screen';
import {
  type RecipientOption,
  VerifierChampScreen,
  VerifierColisScreen,
  VerifierSuiviScreen,
} from '#screens/reception/verifier-colis-screen';

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

const option = (entry: DirectoryEntry): RecipientOption => ({
  ...entry,
  detail: whereabouts(entry),
});

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
      candidates={[DIRECTORY.lea, DIRECTORY.lise, DIRECTORY.louis].map(option)}
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
    reference: '04-reception/reception-scan-en-rafale--choisir-le-destinataire',
  },
  render: () => (
    <ChoisirDestinataireScreen
      query="fonta"
      showCaret
      results={[DIRECTORY.lea, DIRECTORY.louis, DIRECTORY.lise].map(option)}
      recents={[DIRECTORY.nora, DIRECTORY.hugo].map(option)}
    />
  ),
};

/** D15: the directory grows at the desk, so a name read may match nobody yet. */
export const VerifierPersonneInconnue: Story = {
  name: 'Vérifier un colis, personne inconnue',
  render: () => (
    <VerifierColisScreen
      step={{ index: 2, total: 2 }}
      label={{
        heading: UNCERTAIN_LABEL.heading,
        name: 'NORA HADDAD',
        address: UNCERTAIN_LABEL.address,
      }}
      readName="Nora Haddad"
      candidates={[]}
      addPerson={{ name: 'Nora Haddad', onClick: () => {} }}
      submitLabel="Valider et terminer"
      fields={[
        { label: 'Transporteur', value: UNCERTAIN_LABEL.carrier },
        { label: 'Suivi', value: UNCERTAIN_LABEL.tracking, mono: true },
      ]}
    />
  ),
};

/** A parcel passed waits « À compléter », between the doubts and the ready ones. */
export const RevueDuLotPasse: Story = {
  name: 'Revue du lot, colis passé',
  render: () => (
    <RevueLotScreen
      count={RECEPTION_BATCH.count}
      summary="12 colis lus. Un demande votre avis, un reste à compléter, les autres sont prêts."
      toCheck={RECEPTION_BATCH.toCheck.slice(1)}
      toComplete={RECEPTION_BATCH.toCheck.slice(0, 1)}
      ready={RECEPTION_BATCH.ready}
      readyCount={RECEPTION_BATCH.readyCount}
    />
  ),
};

const SETTLED_FIELDS = [
  { label: 'Transporteur', value: 'DHL Express' },
  { label: 'Destinataire', value: DIRECTORY.lea.name },
];

/**
 * §4.4, one field at a time: a DHL Express number no check digit vouches
 * for comes chosen, confirmed in one tap against the photo.
 */
export const VerifierSuivi: Story = {
  name: 'Vérifier un colis, suivi à vérifier',
  render: () => (
    <VerifierSuiviScreen
      step={{ index: 1, total: 2 }}
      label={{
        heading: 'WAYBILL',
        name: '54 1333 7112',
        address: UNCERTAIN_LABEL.address,
      }}
      level="to-verify"
      choices={[{ value: '5413337112', carrier: 'DHL Express' }]}
      selected="5413337112"
      fields={SETTLED_FIELDS}
    />
  ),
};

/** Below 0,60 nothing is chosen: the best readings wait for a tap. */
export const VerifierSuiviIncertain: Story = {
  name: 'Vérifier un colis, suivi sous 0,60',
  render: () => (
    <VerifierSuiviScreen
      step={{ index: 2, total: 2 }}
      label={{
        heading: 'WAYBILL',
        name: '54 1333 711?',
        address: UNCERTAIN_LABEL.address,
        glare: { left: 150, width: 60 },
      }}
      level="none"
      choices={[
        { value: '5413337112', carrier: 'DHL Express' },
        { value: '5413337117', carrier: 'DHL Express' },
      ]}
      fields={[{ label: 'Destinataire', value: DIRECTORY.lea.name }]}
      submitLabel="Valider"
    />
  ),
};

/** An annex field « à vérifier », after the number and the recipient. */
export const VerifierChamp: Story = {
  name: 'Vérifier un colis, poids à vérifier',
  render: () => (
    <VerifierChampScreen
      step={{ index: 1, total: 1 }}
      label={{
        heading: 'Destinataire :',
        name: 'LÉA FONTAINE',
        address: ['WEIGHT 2.4 KG', '75007 PARIS'],
      }}
      question="Le poids est-il juste ?"
      fieldLabel="Poids"
      read="2,4 kg"
      value="2,4"
      unit="kg"
      inputMode="decimal"
      submitLabel="Garder"
      fields={[
        ...SETTLED_FIELDS,
        { label: 'Suivi', value: '5413337112', mono: true },
      ]}
    />
  ),
};

/** Before any search, the scanner's three guesses head the picker. */
export const ChoisirSuggestions: Story = {
  name: 'Choisir le destinataire, suggestions',
  render: () => (
    <ChoisirDestinataireScreen
      query=""
      resultsTitle="Suggestions"
      results={[DIRECTORY.lea, DIRECTORY.lise, DIRECTORY.louis].map(option)}
      recents={[DIRECTORY.nora, DIRECTORY.hugo].map(option)}
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
