import { useState, useSyncExternalStore } from 'react';
import type { Journal } from '#/journal';
import { Composer } from '#/views/composer';
import { JournalView } from '#/views/journal-view';

type View = 'composer' | 'journal';

const VIEWS: readonly { view: View; label: string }[] = [
  { view: 'composer', label: 'Composer' },
  { view: 'journal', label: 'Journal' },
];

type AppProps = {
  journal: Journal;
};

export function App({ journal }: AppProps) {
  useSyncExternalStore(journal.subscribe, journal.getVersion);
  const [view, setView] = useState<View>('composer');

  return (
    <main className="app">
      <nav className="tabs">
        {VIEWS.map((item) => (
          <button
            key={item.view}
            type="button"
            aria-pressed={view === item.view}
            onClick={() => setView(item.view)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="views">
        <div hidden={view !== 'composer'}>
          <Composer journal={journal} />
        </div>
        <div hidden={view !== 'journal'}>
          <JournalView journal={journal} />
        </div>
      </div>
    </main>
  );
}
