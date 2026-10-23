import { useState, useSyncExternalStore } from 'react';
import type { Journal } from '#/journal';
import type { TemplateStore } from '#/templates/store';
import { Composer } from '#/views/composer';
import { JournalView } from '#/views/journal-view';
import { TemplatesView } from '#/views/templates-view';

type View = 'composer' | 'templates' | 'journal';

const VIEWS: readonly { view: View; label: string }[] = [
  { view: 'composer', label: 'Composer' },
  { view: 'templates', label: 'Modèles' },
  { view: 'journal', label: 'Journal' },
];

type AppProps = {
  journal: Journal;
  templates: TemplateStore;
};

export function App({ journal, templates }: AppProps) {
  useSyncExternalStore(journal.subscribe, journal.getVersion);
  const [view, setView] = useState<View>('composer');
  const [, setTemplatesVersion] = useState(0);
  const onTemplatesChange = () => setTemplatesVersion((value) => value + 1);

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
          <Composer journal={journal} templates={templates} />
        </div>
        <div hidden={view !== 'templates'}>
          <TemplatesView templates={templates} onChange={onTemplatesChange} />
        </div>
        <div hidden={view !== 'journal'}>
          <JournalView journal={journal} />
        </div>
      </div>
    </main>
  );
}
