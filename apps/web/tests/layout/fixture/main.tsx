import {
  applyTheme,
  ColisScreen,
  isTheme,
  type Parcel,
  RemettreActions,
  ScannerQrScreen,
} from '@repo/ui';
import { createRoot } from 'react-dom/client';
import { AppShell } from '#/features/shell/components/app-shell';
import {
  followThemeColor,
  paintSiteThemeColor,
  paintThemeColor,
} from '#/features/shell/theme-color';
import '#/styles.css';

/**
 * The app frame around one drawn screen, for the layout test:
 * `?screen=colis&count=20` (Colis and its bottom bar), `?screen=remise`, or
 * `?screen=site` (the landing page, outside the frame),
 * with `&theme=sombre` or `&theme=clair` for a theme set in Réglages.
 */
const params = new URLSearchParams(location.search);
const count = Number(params.get('count') ?? 20);
const theme = params.get('theme');
if (isTheme(theme)) applyTheme(document.documentElement, theme);

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

const app = document.getElementById('app')!;
paintThemeColor();
if (params.get('screen') === 'site') {
  createRoot(app).render(<div data-shell="site">Landing</div>);
  paintSiteThemeColor();
} else {
  createRoot(app).render(<AppShell>{screen}</AppShell>);
  followThemeColor(app);
}
