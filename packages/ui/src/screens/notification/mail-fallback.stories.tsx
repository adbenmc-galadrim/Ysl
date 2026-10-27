import type { Meta, StoryObj } from '@storybook/react-vite';

import { MailFallbackSheet } from '#screens/notification/mail-fallback-sheet';
import { MailAppScreen } from '#screens/reglages/mail-app-screen';

/**
 * After "Envoyer", when the page stayed in front: no mockup, the sheets of
 * #57 and #64. Drawn over the Messagerie screen, where the test lands too.
 */
const meta = {
  title: 'Écrans/06 Notification/Repli de la messagerie',
  component: MailFallbackSheet,
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'light' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  args: {
    description:
      'Aucune app Mail n’est configurée sur cet iPhone, ou iOS a refusé le lien. Essayez une autre messagerie, ou emportez le texte.',
    retry: [
      { label: 'Outlook', href: 'ms-outlook://compose' },
      { label: 'Gmail', href: 'googlegmail:///co' },
    ],
    address: 'nora.haddad@example.com',
    onCopyText: () => {},
    onCopyAddress: () => {},
    onShare: () => {},
    onMarkSent: () => {},
    onAbandon: () => {},
  },
  render: (args) => (
    <>
      <MailAppScreen
        options={[
          { value: 'mailto', title: 'Mail', subtitle: 'Recommandé' },
          { value: 'outlook', title: 'Outlook' },
          { value: 'gmail', title: 'Gmail' },
        ]}
        value="mailto"
        testHref="mailto:"
      />
      <MailFallbackSheet {...args} />
    </>
  ),
} satisfies Meta<typeof MailFallbackSheet>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MailNeSOuvrePas: Story = {
  name: 'Mail ne s’ouvre pas',
};

export const TexteCopie: Story = {
  name: 'Texte copié',
  args: { status: 'Texte copié : collez-le dans votre messagerie.' },
};

export const OutlookDecharge: Story = {
  name: 'Outlook déchargé ou jamais ouvert',
  args: {
    description:
      'Si iOS a affiché « l’adresse n’est pas valide », Outlook n’est pas installé, a été déchargé par l’iPhone ou n’a jamais été ouvert. Ouvrez-le une fois depuis l’écran d’accueil, puis réessayez.',
    retry: [
      { label: 'Mail', href: 'mailto:' },
      { label: 'Gmail', href: 'googlegmail:///co' },
    ],
  },
};

export const EssaiSansEMail: Story = {
  name: 'Essai, sans e-mail suivi',
  args: {
    onMarkSent: undefined,
    onAbandon: undefined,
    onClose: () => {},
  },
};
