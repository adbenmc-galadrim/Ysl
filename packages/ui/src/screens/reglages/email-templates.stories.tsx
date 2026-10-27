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
  'Des colis sont arrivés pour vous. Donnez ce code au comptoir du service courrier.',
  '',
  '{colis}',
  '{reserve}',
  '',
  'Où : {lieu}',
  'Quand :',
  '{horaires}',
  '{consignes}',
  '',
  'Ce colis n’est pas pour vous, ou un collègue passera à votre place ? Répondez simplement à ce mail.',
  '',
  '{agent}',
].join('\n');

const PREVIEW = {
  subject: 'Des colis vous attendent au service courrier',
  body: [
    'Bonjour Nora,',
    '',
    'Votre code de retrait : 4821',
    '',
    'Des colis sont arrivés pour vous. Donnez ce code au comptoir du service courrier.',
    '',
    '• Amazon ···4471, reçu à 10 h 15',
    '• Amazon ···4472, reçu à 10 h 15',
    '',
    'Où : Rez-de-chaussée, comptoir courrier',
    'Quand :',
    'Lun. au ven. : 9 h à 12 h 30 et 14 h à 18 h',
    '',
    'Ce colis n’est pas pour vous, ou un collègue passera à votre place ? Répondez simplement à ce mail.',
    '',
    'Karim Daoud',
  ].join('\n'),
};

const VARIABLES = [
  ['prénom', 'Prénom du destinataire'],
  ['nom', 'Nom du destinataire'],
  ['code', 'Code de retrait'],
  ['colis', 'Les colis, une puce par colis'],
  ['lieu', 'Lieu de retrait (Réglages)'],
  ['horaires', 'Horaires de retrait (Réglages)'],
  ['consignes', 'Consignes (Réglages)'],
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
          subject: 'Des colis vous attendent au service courrier',
          isDefault: true,
        },
        {
          id: '2',
          name: 'Colis volumineux',
          subject: 'Un colis volumineux vous attend',
        },
        {
          id: '3',
          name: 'Relance',
          subject: 'Rappel : vos colis attendent toujours',
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
  isDefault,
  warnings,
}: {
  initial: { name: string; subject: string; body: string };
  isDefault?: boolean;
  warnings?: { title: string; description?: string }[];
}) {
  const [value, setValue] = useState(initial);
  return (
    <EmailTemplateScreen
      {...value}
      onNameChange={(name) => setValue({ ...value, name })}
      onSubjectChange={(subject) => setValue({ ...value, subject })}
      onBodyChange={(body) => setValue({ ...value, body })}
      variables={VARIABLES}
      warnings={warnings}
      preview={PREVIEW}
      previewNote="Sur un colis d’exemple, avec le lieu et les horaires de Réglages."
      tryHref="mailto:karim.daoud@example.com"
      onDuplicate={() => {}}
      onRestore={isDefault ? () => {} : undefined}
      onDelete={isDefault ? undefined : () => {}}
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
      initial={{
        name: 'Avis de retrait',
        subject: 'Des colis vous attendent au service courrier',
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
