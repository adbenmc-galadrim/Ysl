import {
  ColisScreen,
  type Parcel,
  RemettreActions,
  ScannerQrScreen,
} from '@repo/ui';
import { createRoot } from 'react-dom/client';
import { AppShell } from '#/features/shell/components/app-shell';
import '#/styles.css';

/**
 * The app frame around one drawn screen, for the layout test:
 * `?screen=colis&count=20` (Colis and its bottom bar) or `?screen=remise`.
 */
const params = new URLSearchParams(location.search);
const count = Number(params.get('count') ?? 20);

const parcels: Parcel[] = Array.from({ length: count }, (_, i) => ({
  id: `p${i + 1}`,
  recipient: `Colis ${i + 1}`,
  department: 'Comptabilité',
  carrier: 'UPS',
  last4: String(i + 1).padStart(4, '0'),
  state: 'toNotify',
  status: 'Reçu à 10 h 42',
}));

const screen =
  params.get('screen') === 'remise' ? (
    <ScannerQrScreen />
  ) : (
    <ColisScreen
      sync="synced"
      summary={`${count} colis`}
      sections={[{ title: 'À notifier', parcels }]}
      actions={<RemettreActions />}
    />
  );

createRoot(document.getElementById('app')!).render(
  <AppShell>{screen}</AppShell>,
);
