import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  AutoriserCameraMobile,
  CameraRefuseeMobile,
  InstallerAppMobile,
  PreparationHorsLigneMobile,
  TelechargementInterrompuMobile,
} from '#screens/multi-entreprises/01-premier-lancement-et-connexion/navette-departement-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/01 Premier lancement/Navette et département',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const PAGE =
  'multi-entreprises/01-premier-lancement-et-connexion/premier-lancement--navette-et-departement';

export const InstallerApp: Story = {
  name: 'Installer l’app · mobile',
  parameters: { device: { tone: 'light' }, reference: `${PAGE}-installer-l-app-mobile` },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <InstallerAppMobile />,
};

export const AutoriserCamera: Story = {
  name: 'Autoriser la caméra · mobile',
  parameters: { device: { tone: 'light' }, reference: `${PAGE}-autoriser-la-camera-mobile` },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <AutoriserCameraMobile />,
};

export const CameraRefusee: Story = {
  name: 'Caméra refusée · mobile',
  parameters: { device: { tone: 'light' }, reference: `${PAGE}-camera-refusee-mobile` },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <CameraRefuseeMobile />,
};

export const PreparationHorsLigne: Story = {
  name: 'Préparation hors ligne · mobile',
  parameters: { device: { tone: 'light' }, reference: `${PAGE}-preparation-hors-ligne-mobile` },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <PreparationHorsLigneMobile />,
};

export const TelechargementInterrompu: Story = {
  name: 'Téléchargement interrompu · mobile',
  parameters: { device: { tone: 'light' }, reference: `${PAGE}-telechargement-interrompu-mobile` },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <TelechargementInterrompuMobile />,
};
