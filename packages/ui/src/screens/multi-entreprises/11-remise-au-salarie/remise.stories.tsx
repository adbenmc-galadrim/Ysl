import type { Meta, StoryObj } from '@storybook/react-vite';

import { ScanCorners } from '#components/phone-parts';
import { CounterScene, EmployeePhone } from '#screens/multi-entreprises/11-remise-au-salarie/remise-parts';
import { RemiseCodeScreen } from '#screens/remise/remise-code-screen';
import { RemiseColisScreen, type RemiseParcel } from '#screens/remise/remise-colis-screen';
import { RemiseConfirmeeScreen } from '#screens/remise/remise-confirmee-screen';
import { ScannerQrScreen } from '#screens/remise/scanner-qr-screen';
import { SignatureScreen } from '#screens/remise/signature-screen';
import { NORA_HANDOVER } from '#fixtures/handover';

const SCENE = (
  <>
    <CounterScene />
    <EmployeePhone />
  </>
);
const LABEL_SCENE = (
  <>
    <CounterScene />
    <div className="absolute top-[200px] left-[86px] h-[300px] w-[220px] rounded-[8px] bg-kraft">
      <div className="absolute top-[30px] left-5 h-[150px] w-[180px] rounded-[4px] bg-paper font-label font-bold text-label-ink">
        <p className="absolute top-3 left-3 text-18">amazon</p>
        <p className="absolute top-[50px] left-3 text-14">NORA HADDAD</p>
        <span className="absolute top-24 left-3 h-[38px] w-[156px] bg-label-ink" />
      </div>
    </div>
    <ScanCorners x={76} y={210} size={240} color="bg-ios-green" />
  </>
);
const NORA = { name: 'Nora Haddad', initials: 'NH', department: 'Studio' };
const TWO_PARCELS: RemiseParcel[] = ['4471', '4472'].map((last4) => ({
  ...NORA_HANDOVER[0]!,
  id: last4,
  carrier: 'Amazon',
  last4,
  received: 'À scanner',
  sender: undefined,
  registered: false,
  damaged: false,
}));

const meta = {
  title: 'Écrans/Multi-entreprises/11 Remise au salarié/Remise',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const ScannerLeQr: Story = {
  name: 'Scanner le QR · mobile',
  parameters: {
    device: { tone: 'dark' },
    reference: 'multi-entreprises/11-remise-au-salarie/remise--departement-remise-scanner-le-qr-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => (
    <ScannerQrScreen
      title="Remise · Studio"
      video={SCENE}
      corners="bg-white"
    />
  ),
};

export const CodeAutreDepartement: Story = {
  name: 'Code d’un autre département · mobile',
  parameters: {
    device: { tone: 'dark' },
    reference: 'multi-entreprises/11-remise-au-salarie/remise--departement-remise-code-d-un-autre-departement-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => (
    <ScannerQrScreen
      title="Remise · Studio"
      video={SCENE}
      corners="bg-ios-red"
      notice={{
        title: 'Ce colis est à Finance',
        description:
          'Léa Fontaine le retire au bâtiment B, 4e étage, bureau 412. Rien n’a été remis.',
        icon: { name: 'alert', className: 'text-ios-red' },
        action: { label: 'Scanner un autre code', onClick: () => {} },
      }}
    />
  ),
};

export const ScanDuColis: Story = {
  name: 'Scan du colis · mobile',
  parameters: {
    device: { tone: 'dark' },
    reference: 'multi-entreprises/11-remise-au-salarie/remise--departement-remise-scan-du-colis-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => (
    <ScannerQrScreen
      title="1 sur 2"
      video={LABEL_SCENE}
      actions={false}
      notice={{
        title: 'Amazon ···4471 · c’est le bon colis',
        description: 'Plus qu’un à scanner',
        icon: { name: 'check', className: 'text-ios-green' },
      }}
    />
  ),
};

export const SesColis: Story = {
  name: 'Ses colis, scan obligatoire · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/11-remise-au-salarie/remise--departement-remise-ses-colis-scan-obligatoire-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => (
    <RemiseColisScreen
      recipient={NORA}
      location="2e étage"
      verified="QR vérifié à 11:20"
      parcels={TWO_PARCELS}
      scan={{
        label: 'Colis scannés',
        action: 'Scanner les 2 colis',
        done: false,
        required: true,
        banner: {
          title: 'Scan du colis demandé',
          description: 'Scannez chaque colis remis (réglage de l’entreprise).',
        },
        onScan: () => {},
      }}
      onCollector={() => {}}
      onSignature={() => {}}
    />
  ),
};

export const CodeDeRetrait: Story = {
  name: 'Code de retrait · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/11-remise-au-salarie/remise--departement-code-de-retrait-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => (
    <RemiseCodeScreen
      code="5107"
      invalid
      elsewhere={{
        title: 'Ce code est pour Finance',
        description:
          'Le colis de Léa Fontaine se retire au bâtiment B, 4e étage. Rien n’a été remis.',
      }}
    />
  ),
};

export const Signature: Story = {
  name: 'Signature · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/11-remise-au-salarie/remise--departement-signature-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => (
    <SignatureScreen
      title="Nora Haddad signe pour 2 colis"
      detail="Signature obligatoire chez Atelier Lumen"
      strokes={['M60,230C80,150,100,260,120,200C140,140,160,170,180,210C200,250,230,180,280,200']}
    />
  ),
};

export const Confirmee: Story = {
  name: 'Remise confirmée · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/11-remise-au-salarie/remise--departement-remise-confirmee-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => (
    <RemiseConfirmeeScreen
      title="2 colis remis"
      description="à Nora Haddad, à 11:21 · Studio"
      proofs={[
        { icon: 'qr', label: 'QR code vérifié', done: true },
        { icon: 'scan', label: '2 colis scannés', done: true },
        { icon: 'cloud', label: 'Envoyé au serveur', done: true },
      ]}
    />
  ),
};

export const ParLaNavette: Story = {
  name: 'Par la navette, petit site · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/11-remise-au-salarie/remise--navette-profil-petit-site-remise-par-la-navette-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => (
    <RemiseColisScreen
      recipient={{ ...NORA, department: 'Remis par la navette' }}
      standIn={{
        title: 'La navette fait office de département',
        description:
          'Profil « Petit site » : Karim remet lui-même, au service courrier.',
      }}
      parcels={[{ ...TWO_PARCELS[0]!, carrier: 'UPS', last4: '8810', received: 'Reçu hier' }]}
    />
  ),
};
