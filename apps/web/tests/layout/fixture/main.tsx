import {
  applyTheme,
  ColisScreen,
  isTheme,
  type Parcel,
  RemettreActions,
  ScannerQrScreen,
} from '@repo/ui';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { createRoot } from 'react-dom/client';
import type { LocalParcel } from '#/features/db/schema';
import { DAY_MS } from '#/features/parcels/model';
import { SearchView } from '#/features/search/components/search-view';
import { toSearchEntry } from '#/features/search/search-index';
import { AppShell } from '#/features/shell/components/app-shell';
import {
  followThemeColor,
  paintSiteThemeColor,
  paintThemeColor,
} from '#/features/shell/theme-color';
import '#/styles.css';
import { contactRow, NOW, parcelRow } from '../../helpers/local-rows';

/**
 * The app frame around one drawn screen, for the layout test:
 * `?screen=colis&count=20` (Colis and its bottom bar), `?screen=remise`,
 * `?screen=recherche&count=500` (the search over that many local parcels), or
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

const NAMES = ['Inès Garnier', 'Romain Garnier', 'Hugo Lambert', 'Nora Saïdi'];
const STATUSES: LocalParcel['status'][] = ['recu', 'notifie', 'remis'];

/** Parcels of a busy desk over a few weeks, for the search. */
function journal() {
  const t = createTranslator(DEFAULT_LOCALE);
  const contacts = NAMES.map((name, i) => contactRow({ id: `c${i}`, name }));
  const context = {
    people: new Map(),
    contacts: new Map(contacts.map((contact) => [contact.id, contact])),
  };
  return Array.from({ length: count }, (_, i) => {
    const status = STATUSES[i % STATUSES.length]!;
    const day = new Date(NOW.getTime() - (i % 40) * DAY_MS);
    const parcel = parcelRow({
      id: `p${i + 1}`,
      status,
      contactId: `c${i % NAMES.length}`,
      tracking: `1Z${String(i + 1).padStart(8, '0')}`,
      department: i % 2 ? 'Comptabilité' : 'Studio',
      receivedAt: day,
      notifiedAt: status === 'recu' ? null : day,
      deliveredAt: status === 'remis' ? day : null,
      deliveredBy: status === 'remis' ? 'agent-1' : null,
    });
    return toSearchEntry(parcel, context, NOW, t)!;
  });
}

const screen =
  params.get('screen') === 'remise' ? (
    <ScannerQrScreen />
  ) : params.get('screen') === 'recherche' ? (
    <SearchView entries={journal()} now={NOW} onCancel={() => {}} />
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
