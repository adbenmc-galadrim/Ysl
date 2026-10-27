import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { MailAppScreen } from '#screens/reglages/mail-app-screen';

const OPTIONS = [
  {
    value: 'mailto',
    title: 'Mail',
    subtitle: 'Recommandé : l’app de messagerie de l’iPhone',
  },
  {
    value: 'outlook',
    title: 'Outlook',
    subtitle: 'À ouvrir une fois avant le premier envoi',
  },
  {
    value: 'gmail',
    title: 'Gmail',
    subtitle: 'À ouvrir une fois avant le premier envoi',
  },
];

/** No mockup: the settings screens of #57, ticked like Apparence. */
const meta = {
  title: 'Écrans/08 Réglages/Messagerie',
  component: MailAppScreen,
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'light' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  args: {
    options: OPTIONS,
    value: 'mailto',
    footer:
      '« Envoyer » ouvre l’e-mail prérempli dans cette app. Le choix vaut pour cet iPhone.',
    testHref: 'mailto:',
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <MailAppScreen {...args} value={value} onChange={setValue} />;
  },
} satisfies Meta<typeof MailAppScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Messagerie: Story = {};

export const TestReussi: Story = {
  name: 'Test réussi',
  args: {
    result: {
      tone: 'green',
      title: 'Mail s’est ouvert',
      description: 'Revenez ici et supprimez le brouillon vide.',
    },
  },
};

export const TestEchoue: Story = {
  name: 'Test échoué',
  args: {
    value: 'outlook',
    testHref: 'ms-outlook://compose',
    result: {
      tone: 'orange',
      title: 'Outlook ne s’est pas ouvert',
      description:
        'Si iOS a affiché « l’adresse n’est pas valide », Outlook n’est pas installé, a été déchargé par l’iPhone ou n’a jamais été ouvert. Ouvrez-le une fois depuis l’écran d’accueil, puis réessayez.',
    },
  },
};
