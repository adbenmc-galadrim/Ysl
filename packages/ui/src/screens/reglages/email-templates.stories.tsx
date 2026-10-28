import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { EmailTemplateScreen } from '#screens/reglages/email-template-screen';
import { EmailTemplatesScreen } from '#screens/reglages/email-templates-screen';

const meta = {
  title: 'Écrans/08 Réglages/Modèles d’e-mail',
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'light' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const BODY = [
  'Bonjour {prénom},',
  '',
  'Votre code de retrait : {code}',
  '',
  'Nous avons reçu pour vous :',
  '{colis}',
  '{reserve}',
  '',
  'Où : {lieu}',
  'Quand : {horaires}',
  '{consignes}',
  '',
  'Donnez votre code au comptoir du service courrier. Un colis n’est pas pour vous, ou un collègue passera à votre place ? Répondez simplement à ce mail.',
  '',
  '{agent}',
  'Service Courrier',
].join('\n');

const PREVIEW = {
  subject: '2 colis en attente de retrait – Service Courrier',
  body: [
    'Bonjour Nora,',
    '',
    'Votre code de retrait : 4821',
    '',
    'Nous avons reçu pour vous :',
    '• Amazon ···4471, reçu à 10 h 15',
    '• UPS ···0622, de Zalando, 2 pièces sur 3, reçu à 10 h 15',
    '',
    'Où : Rez-de-chaussée, comptoir courrier',
    'Quand : Lun. au ven. : 9 h à 12 h 30 et 14 h à 18 h',
    '',
    'Donnez votre code au comptoir du service courrier. Un colis n’est pas pour vous, ou un collègue passera à votre place ? Répondez simplement à ce mail.',
    '',
    'Karim Daoud',
    'Service Courrier',
  ].join('\n'),
};

const VARIABLES = [
  ['prénom', 'Prénom du destinataire'],
  ['nom', 'Nom du destinataire'],
  ['code', 'Code de retrait'],
  ['colis', 'Les colis, une puce par colis'],
  ['nombre_colis', '« Colis » ou « 2 colis », pour l’objet'],
  ['lieu', 'Lieu de retrait (Réglages), ligne retirée si vide'],
  ['horaires', 'Horaires de retrait (Réglages), ligne retirée si vides'],
  ['consignes', 'Consignes (Réglages), ligne retirée si vide'],
  ['reserve', 'Colis arrivés abîmés à signaler'],
  ['agent', 'Votre nom'],
  ['lien_pas_moi', 'Lien « Ce n’est pas à moi »'],
  ['lien_collegue', 'Lien « Un collègue passera »'],
].map(([name, hint]) => ({ name: name!, hint: hint! }));

export const Liste: Story = {
  render: () => (
    <EmailTemplatesScreen
      templates={[
        {
          id: '1',
          name: 'Avis de retrait',
          subject: '{nombre_colis} en attente de retrait – Service Courrier',
          isDefault: true,
          group: 'Avis de retrait',
        },
        {
          id: '2',
          name: 'Colis volumineux',
          subject: 'Un colis volumineux vous attend',
          group: 'Avis de retrait',
        },
        {
          id: '3',
          name: 'Relance',
          subject: 'Rappel : colis en attente de retrait – Service Courrier',
          isDefault: true,
          group: 'Relances',
        },
      ]}
      onOpen={() => {}}
      onCreate={() => {}}
      onBack={() => {}}
    />
  ),
};

function Editor({
  initial,
  typeNote,
  isDefault,
  preset,
  warnings,
}: {
  initial: { name: string; subject: string; body: string };
  typeNote?: string;
  isDefault?: boolean;
  /** The template the app ships: restored, never deleted. */
  preset?: boolean;
  warnings?: { title: string; description?: string }[];
}) {
  const [value, setValue] = useState(initial);
  return (
    <EmailTemplateScreen
      {...value}
      typeNote={typeNote}
      onNameChange={(name) => setValue({ ...value, name })}
      onSubjectChange={(subject) => setValue({ ...value, subject })}
      onBodyChange={(body) => setValue({ ...value, body })}
      variables={VARIABLES}
      warnings={warnings}
      preview={PREVIEW}
      previewNote="Sur un colis d’exemple, avec le lieu et les horaires de Réglages."
      tryHref="mailto:karim.daoud@example.com"
      onDuplicate={() => {}}
      isDefault={isDefault}
      onMakeDefault={isDefault ? undefined : () => {}}
      onRestore={preset ? () => {} : undefined}
      onDelete={isDefault || preset ? undefined : () => {}}
      onBack={() => {}}
      onDone={() => {}}
    />
  );
}

export const ModeleParDefaut: Story = {
  name: 'Modèle par défaut',
  render: () => (
    <Editor
      isDefault
      preset
      initial={{
        name: 'Avis de retrait',
        subject: '{nombre_colis} en attente de retrait – Service Courrier',
        body: BODY,
      }}
    />
  ),
};

export const VariableInconnue: Story = {
  name: 'Variable inconnue',
  render: () => (
    <Editor
      initial={{
        name: 'Colis volumineux',
        subject: 'Un colis volumineux vous attend',
        body: `Bonjour {prenom},\n\n${BODY}`,
      }}
      warnings={[
        {
          title: 'Variable inconnue : {prenom}',
          description:
            'Elle restera telle quelle dans l’e-mail. Vouliez-vous dire {prénom} ?',
        },
      ]}
    />
  ),
};

export const ModeleLivreNonParDefaut: Story = {
  name: 'Modèle livré, un autre par défaut',
  render: () => (
    <Editor
      preset
      initial={{
        name: 'Avis de retrait',
        subject: '{nombre_colis} en attente de retrait – Service Courrier',
        body: BODY,
      }}
    />
  ),
};

export const ModelePersoParDefaut: Story = {
  name: 'Modèle personnel par défaut',
  render: () => (
    <Editor
      isDefault
      initial={{
        name: 'Colis volumineux',
        subject: '{nombre_colis} volumineux à retirer',
        body: BODY,
      }}
    />
  ),
};

export const ModeleDeRelance: Story = {
  name: 'Modèle de relance',
  render: () => (
    <Editor
      isDefault
      preset
      typeNote="Relance : il sert aux rappels des colis qui attendent leur retrait."
      initial={{
        name: 'Relance',
        subject: 'Rappel : colis en attente de retrait – Service Courrier',
        body: BODY.replace(
          'Votre code de retrait : {code}',
          'Petit rappel : votre code de retrait reste {code}.',
        ),
      }}
    />
  ),
};
