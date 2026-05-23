import { useData } from '../context/DataContext';
import type { GeneratedSite } from '../types';

interface WebsitesProps {
  onOpenSiteEditor?: (site: GeneratedSite) => void;
}

export default function Websites({ onOpenSiteEditor }: WebsitesProps) {
  const { websites, siteData, deployWebsite, addNotification } = useData();

  const handleDeploy = (siteId: number) => {
    deployWebsite(siteId);
    addNotification('Site deployed to Vercel successfully');
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between mb-8">
        <div className="text-3xl tracking-[-1px] font-semibold">Websites</div>
      </div>

      {websites.length === 0 ? (
        <div className="text-center text-zinc-500 text-sm mt-12 bg-zinc-900 border border-zinc-800 rounded-3xl p-12">
          <div className="text-lg mb-2">No websites yet</div>
          <div className="text-xs text-zinc-600">
            Generate a website from the Discover page to get started.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {websites.map((site) => (
            <div key={site.id} className="border border-zinc-800 rounded-3xl bg-zinc-900 p-7 flex flex-col">
              <div className="flex justify-between">
                <div>
                  <div className="font-semibold tracking-tight text-xl">{site.name}</div>
                  <div className="text-xs text-zinc-400">
                    {site.business} • {site.variant}
                  </div>
                </div>
                <div
                  className={`text-xs px-3 h-6 flex items-center rounded-full ${
                    site.status === 'live'
                      ? 'bg-emerald-500 text-black'
                      : site.status === 'deployed'
                      ? 'bg-blue-500 text-white'
                      : 'bg-zinc-700 text-zinc-300'
                  }`}
                >
                  {site.status}
                </div>
              </div>

              {site.opportunityScore && (
                <div className="mt-4 text-xs text-zinc-500">
                  Opportunity score: <span className="text-white font-mono">{site.opportunityScore}</span>
                </div>
              )}

              <div className="mt-auto pt-8 flex gap-3">              <button
                onClick={() => {
                  if (!onOpenSiteEditor) {
                    addNotification('Visual editor not available');
                    return;
                  }
                  // Try to restore full site data from storage
                  const stored = site.id ? siteData[site.id] : null;
                  if (stored) {
                    onOpenSiteEditor(stored);
                  } else {
                    // Reconstruct with defaults for fields not stored in Website
                    const generated: GeneratedSite = {
                      id: site.id,
                      name: site.name,
                      business: site.business,
                      variant: site.variant || 'Modern',
                      hero: site.heroHeadline || `Premium website for ${site.business}`,
                      tagline: 'Professional, modern, and built for success.',
                      issues: site.issues || [],
                      score: site.opportunityScore || 0,
                      aboutTitle: `About ${site.business}`,
                      aboutText: `Learn more about ${site.business} and what they offer.`,
                      servicesTitle: 'Our Services',
                      services: [{ name: 'Web Design', description: 'Professional web design services' }],
                      galleryTitle: 'Our Work',
                      contactTitle: 'Get In Touch',
                      contactEmail: '',
                      contactPhone: '',
                      contactAddress: '',
                      primaryColor: '#2563eb',
                      secondaryColor: '#64748b',
                      accentColor: '#7c3aed',
                      visibleSections: ['about', 'services', 'gallery', 'contact'],
                    };
                    onOpenSiteEditor(generated);
                  }
                }}
                className="flex-1 py-3 border border-zinc-700 text-xs tracking-widest rounded-2xl hover:bg-zinc-800 transition-colors"
              >
                EDIT IN VISUAL EDITOR
              </button>
                <button
                  onClick={() => handleDeploy(site.id)}
                  disabled={site.status === 'live'}
                  className="flex-1 py-3 bg-white text-black text-xs tracking-widest rounded-2xl disabled:opacity-40 hover:bg-zinc-200 transition-colors"
                >
                  {site.status === 'live' ? 'LIVE' : 'DEPLOY TO VERCEL'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
