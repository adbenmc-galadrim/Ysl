import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  DIRECTORY,
  type DirectoryEntry,
  RECEPTION_BATCH,
  UNCERTAIN_LABEL,
  whereabouts,
} from '#fixtures/reception';
import { ChoisirDestinataireScreen } from '#screens/reception/choisir-destinataire-screen';
import { HorsAnnuaireSheet } from '#screens/reception/hors-annuaire-sheet';
import { TransporteurSheet } from '#screens/reception/transporteur-sheet';
import { LotEnregistreScreen } from '#screens/reception/lot-enregistre-screen';
import { RevueLotScreen } from '#screens/reception/revue-lot-screen';
import {
  type RecipientOption,
  VerifierChampScreen,
  VerifierColisScreen,
  VerifierSourceLink,
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

/** The link to the diagnostic under the question (YSL-59, no reference). */
export const VerifierSuiviSource: Story = {
  name: 'Vérifier un colis, d’où vient cette valeur',
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
      source={<VerifierSourceLink />}
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

/** Nothing read: the number is typed, or the parcel has none (YSL-64, no reference). */
export const VerifierSuiviNonLu: Story = {
  name: 'Vérifier un colis, numéro non lu',
  render: () => (
    <VerifierSuiviScreen
      step={{ index: 1, total: 1 }}
      label={{
        heading: 'Destinataire :',
        name: 'L. FONTAIN',
        address: UNCERTAIN_LABEL.address,
        glare: { left: 40, width: 220 },
      }}
      level="none"
      choices={[]}
      fields={[]}
      onType={() => {}}
      onUntracked={() => {}}
    />
  ),
};

/** The number holds but names no carrier: the agent says which (YSL-64). */
export const VerifierTransporteur: Story = {
  name: 'Vérifier un colis, transporteur inconnu',
  render: () => (
    <VerifierSuiviScreen
      step={{ index: 1, total: 1 }}
      label={{
        heading: 'WAYBILL',
        name: '4815 1623 42',
        address: UNCERTAIN_LABEL.address,
      }}
      level="carrier"
      choices={[{ value: '4815162342' }]}
      selected="4815162342"
      submitLabel="Choisir le transporteur"
      fields={[{ label: 'Destinataire', value: DIRECTORY.lea.name }]}
      onType={() => {}}
      onUntracked={() => {}}
    />
  ),
};

const CARRIERS = [
  'Colissimo',
  'Chronopost',
  'La Poste',
  'DHL Express',
  'DHL Paket',
  'UPS',
  'FedEx',
  'DPD',
  'GLS',
  'TNT',
  'Amazon',
  'Mondial Relay',
  'Colis Privé',
];

export const ChoisirTransporteur: Story = {
  name: 'Choisir le transporteur',
  render: () => (
    <TransporteurSheet
      tracking="4815162342"
      carriers={CARRIERS}
      value="DPD"
      onPick={() => {}}
      behind={
        <VerifierSuiviScreen
          step={{ index: 1, total: 1 }}
          level="carrier"
          choices={[{ value: '4815162342' }]}
          selected="4815162342"
          fields={[]}
        />
      }
    />
  ),
};

export const PersonneHorsAnnuaire: Story = {
  name: 'Personne hors annuaire',
  render: () => (
    <HorsAnnuaireSheet
      value={{ name: 'Marc Petit', email: '', department: 'Intérim' }}
      onChange={() => {}}
      onSubmit={() => {}}
      behind={
        <ChoisirDestinataireScreen
          query="marc"
          results={[]}
          recents={[DIRECTORY.nora, DIRECTORY.hugo].map(option)}
        />
      }
    />
  ),
};

/** Réglages › Annuaire › a contact: its card, and the directory card it can now join. */
export const ModifierContact: Story = {
  name: 'Modifier un contact hors annuaire',
  render: () => (
    <HorsAnnuaireSheet
      title="Modifier le contact"
      description="Proposé à la réception de ses colis, sur tous les iPhone."
      submitLabel="Enregistrer"
      value={{
        name: 'Marc Petit',
        email: 'marc.petit@prestataire.fr',
        department: 'Prestataire, 4e étage',
      }}
      onChange={() => {}}
      onSubmit={() => {}}
      onDelete={() => {}}
      merge={{
        name: 'Marc Petit',
        initials: 'MP',
        detail: 'Studio, 2e étage',
        label: 'Rattacher à Marc Petit',
        onMerge: () => {},
      }}
    />
  ),
};

/** From « Sans e-mail » on the parcel's record: the same sheet, on the address. */
export const AjouterEmailContact: Story = {
  name: 'Ajouter l’e-mail d’un contact',
  render: () => (
    <HorsAnnuaireSheet
      title="Ajouter son e-mail"
      description="Gardée sur le contact, l’adresse servira aux prochains colis."
      submitLabel="Enregistrer"
      value={{ name: 'Nina Roux', email: '', department: 'Intérim' }}
      onChange={() => {}}
      onSubmit={() => {}}
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

/** As the app shows it: offline row hidden, the parcels it could not settle. */
export const LotEnregistreReserveEtPieces: Story = {
  name: 'Lot enregistré, réserve et pièces',
  render: () => (
    <LotEnregistreScreen
      count={6}
      span="Lot de 14 h 02 à 14 h 09"
      emails={3}
      sendLabel="Envoyer 3 e-mails"
      note="Chaque personne reçoit un seul e-mail avec tous ses colis et son code de retrait."
      outcomes={[
        {
          icon: 'mail',
          tone: 'blue',
          title: '3 e-mails prêts',
          detail: '5 colis pour 3 personnes',
          onClick: () => {},
        },
        {
          icon: 'alert',
          tone: 'red',
          title: '1 à compléter',
          detail: 'Rangé dans À compléter, non notifié',
          onClick: () => {},
        },
        {
          icon: 'alert',
          tone: 'orange',
          title: '1 avec réserve',
          detail: 'Notée sur la fiche du colis',
        },
        {
          icon: 'package',
          tone: 'neutral',
          title: '2 en plusieurs pièces',
          detail: 'Comptés pièce par pièce',
        },
      ]}
    />
  ),
};

/** Nothing to send: every parcel waits for its record. */
export const LotEnregistreSansEmail: Story = {
  name: 'Lot enregistré, aucun e-mail',
  render: () => (
    <LotEnregistreScreen
      count={1}
      span="Lot de 14 h 02 à 14 h 03"
      emails={0}
      note="Chaque personne reçoit un seul e-mail avec tous ses colis et son code de retrait."
      outcomes={[
        {
          icon: 'alert',
          tone: 'red',
          title: '1 à compléter',
          detail: 'Rangé dans À compléter, non notifié',
          onClick: () => {},
        },
      ]}
    />
  ),
};
