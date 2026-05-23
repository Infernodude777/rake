import { useState, useCallback } from 'react';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useData } from './context/DataContext';

import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import CommandPalette from './components/CommandPalette';
import SiteEditor from './components/SiteEditor';

import Dashboard from './pages/Dashboard';
import Discover from './pages/Discover';
import Leads from './pages/Leads';
import Websites from './pages/Websites';
import Outreach from './pages/Outreach';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';

import type { GeneratedSite } from './types';

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [commandOpen, setCommandOpen] = useState(false);
  const [siteEditorOpen, setSiteEditorOpen] = useState(false);
  const [generatedSite, setGeneratedSite] = useState<GeneratedSite | null>(null);
  const { websites, deployWebsite, addNotification } = useData();

  const openCommand = useCallback(() => setCommandOpen(true), []);
  const closeCommand = useCallback(() => setCommandOpen(false), []);

  const executeCommand = useCallback((cmd: string) => {
    closeCommand();
    setActivePage(cmd);
  }, [closeCommand]);

  useKeyboardShortcuts([
    { key: 'k', meta: true, handler: () => setCommandOpen((prev) => !prev) },
    { key: 'Escape', handler: () => { setCommandOpen(false); setSiteEditorOpen(false); } },
  ], [commandOpen, siteEditorOpen]);

  const handleOpenSiteEditor = useCallback((site: GeneratedSite) => {
    setGeneratedSite(site);
    setSiteEditorOpen(true);
  }, []);

  const handleCloseSiteEditor = useCallback(() => setSiteEditorOpen(false), []);

  const handlePublishSite = useCallback(() => {
    if (!generatedSite) return;
    const match = websites.find(
      (w) => w.business === generatedSite.business && w.name === generatedSite.name
    );
    if (match) {
      deployWebsite(match.id);
      addNotification(`${generatedSite.name} published live! 🚀`);
      setActivePage('websites');
    }
    setSiteEditorOpen(false);
  }, [generatedSite, websites, deployWebsite, addNotification]);

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard onNavigate={setActivePage} />;
      case 'discover': return <Discover onNavigate={setActivePage} onOpenSiteEditor={handleOpenSiteEditor} />;
      case 'leads': return <Leads />;
      case 'websites': return <Websites />;
      case 'outreach': return <Outreach />;
      case 'analytics': return <Analytics />;
      case 'settings': return <Settings />;
      default: return <Dashboard onNavigate={setActivePage} />;
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden font-sans">
      <Sidebar activePage={activePage} onNavigate={setActivePage} onOpenCommand={openCommand} />

      <div className="flex-1 flex flex-col">
        <Topbar onOpenCommand={openCommand} />

        <div className="flex-1 overflow-auto">
          {renderPage()}
        </div>
      </div>

      <CommandPalette open={commandOpen} onClose={closeCommand} onExecute={executeCommand} />

      <SiteEditor
        open={siteEditorOpen}
        site={generatedSite}
        onClose={handleCloseSiteEditor}
        onPublish={handlePublishSite}
      />
    </div>
  );
}
