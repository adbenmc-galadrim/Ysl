import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { LABEL_PHOTO_URL } from '#fixtures/label-photo';
import { SCANNED_LABEL } from '#fixtures/reception';
import { LectureScreen } from '#screens/colis/lecture-screen';
import { ScanScreen, type ScanReading } from '#screens/reception/scan-screen';
import {
  SignalerScanButton,
  SignalerScanSheet,
  SignalerScanToast,
} from '#screens/reception/signaler-scan';

/** Test phase only (D32), no mock-up: drawn in the scan screen's own style. */
const meta = {
  title: 'Écrans/04 Réception/Signaler un scan',
  component: ScanScreen,
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'dark' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  args: { count: 12, label: SCANNED_LABEL },
} satisfies Meta<typeof ScanScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

const READ: ScanReading = {
  kind: 'read',
  last: { name: 'Hugo Lefèvre', meta: 'DHL ···7112' },
  fields: [
    { label: 'Transporteur', value: 'UPS' },
    { label: 'Suivi', value: SCANNED_LABEL.tracking, mono: true },
    { label: 'Destinataire', value: 'Camille Morel ?', status: 'warning' },
  ],
};

export const Lecture: Story = {
  name: 'Lecture, signaler',
  args: {
    onUndo: () => undefined,
    reading: READ,
    report: <SignalerScanButton />,
  },
};

export const Illisible: Story = {
  name: 'Étiquette illisible, signaler',
  args: {
    reading: {
      kind: 'unreadable',
      title: 'Étiquette illisible',
      hint: 'Rapprochez-vous ou saisissez le numéro.',
    },
    report: <SignalerScanButton />,
  },
};

export const Commentaire: Story = {
  args: { reading: READ },
  render: (args) => {
    const [comment, setComment] = useState('Le destinataire est faux');
    return (
      <SignalerScanSheet
        comment={comment}
        onCommentChange={setComment}
        behind={
          <ScanScreen {...args} reading={READ} controls={false} dim={0.4} />
        }
      />
    );
  },
};

/** Away from the scan screen, the sheet says what leaves instead (YSL-151). */
export const CommentaireHorsScan: Story = {
  name: 'Commentaire, hors Scan',
  args: { reading: READ },
  parameters: { device: { tone: 'light' } },
  render: () => {
    const [comment, setComment] = useState('');
    return (
      <SignalerScanSheet
        comment={comment}
        onCommentChange={setComment}
        description="La photo enregistrée de l’étiquette (1 600 px) et ce que l’iPhone a gardé de sa lecture partent avec le rapport, pour améliorer la lecture. Phase de test."
        behind={
          <LectureScreen
            subtitle="Lu le 20 oct. à 9 h 00 sur cet iPhone"
            photo={{ src: LABEL_PHOTO_URL, alt: 'Photo de l’étiquette' }}
          />
        }
      />
    );
  },
};

export const Confirmation: Story = {
  name: 'Rapport en file',
  args: {
    onUndo: () => undefined,
    reading: READ,
    report: (
      <SignalerScanToast
        className="w-full"
        message="Rapport enregistré, envoi en cours"
      />
    ),
  },
};
