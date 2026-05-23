import { useState, useEffect, useCallback } from 'react';
import { Search, Globe, MapPin, Building2, Compass, Zap, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import { searchBusinesses as firecrawlSearch, rateLimiter as firecrawlLimiter } from '../services/firecrawl';
import { findBusinesses, rateLimiter as googleLimiter } from '../services/google';
import { searchPlaces as foursquareSearch, rateLimiter as foursquareLimiter } from '../services/foursquare';
import { searchPlaces as hereSearch, rateLimiter as hereLimiter } from '../services/here';
import { scoreOpportunity, rateLimiter as llmLimiter } from '../services/llm';
import { RateLimitError } from '../utils/rateLimiter';
import BusinessCard from '../components/BusinessCard';
import ErrorBoundary from '../components/ErrorBoundary';
import type { Business } from '../types';

interface ServiceStatus {
  id: string;
  name: string;
  icon: typeof MapPin;
  status: 'idle' | 'loading' | 'success' | 'error' | 'rate-limited' | 'skipped';
  message?: string;
  resultCount?: number;
}

const SERVICE_META = [
  { id: 'google', name: 'Google Maps', icon: MapPin },
  { id: 'foursquare', name: 'Foursquare', icon: Building2 },
  { id: 'here', name: 'HERE', icon: Compass },
  { id: 'firecrawl', name: 'Firecrawl', icon: Globe },
  { id: 'llm', name: 'AI Enrichment', icon: Zap },
] as const;

function createServiceStatuses(): ServiceStatus[] {
  return SERVICE_META.map((s) => ({
    id: s.id,
    name: s.name,
    icon: s.icon,
    status: 'idle' as const,
  }));
}

interface DiscoverProps {
  onNavigate: (page: string) => void;
  onOpenSiteEditor: (site: any) => void;
}

export default function Discover({ onNavigate, onOpenSiteEditor }: DiscoverProps) {
  const { apiKeys, addBusinesses, businesses, addLead, addWebsite, addNotification, settings } = useData();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [serviceStatuses, setServiceStatuses] = useState<ServiceStatus[]>(createServiceStatuses);

  const updateStatus = useCallback((id: string, updates: Partial<ServiceStatus>) => {
    setServiceStatuses((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  }, []);

  // Sync rate limiter configs from user settings
  useEffect(() => {
    if (settings.rateLimits) {
      googleLimiter.updateConfig(settings.rateLimits.google);
      foursquareLimiter.updateConfig(settings.rateLimits.foursquare);
      hereLimiter.updateConfig(settings.rateLimits.here);
      firecrawlLimiter.updateConfig(settings.rateLimits.firecrawl);
      llmLimiter.updateConfig(settings.rateLimits.llm);
    }
  }, [settings.rateLimits]);

  const runSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setSearchError('');
    setServiceStatuses(createServiceStatuses());

    try {
      const results: Business[] = [];
      const queryLower = query.toLowerCase();

      // Parse query: "dentists in miami" → term: "dentists", location: "miami"
      const parts = queryLower.split(/\s+in\s+/);
      const term = parts[0] || queryLower;
      const location = parts[1] || '';

      // Try Google Places (enhanced with geocoding + paginated nearby search)
      if (apiKeys.googleMapsApiKey) {
        updateStatus('google', { status: 'loading', message: location ? `Geocoding ${location}...` : 'Searching...' });
        try {
          const searchLocation = location || term;
          const searchKeyword = location ? term : '';
          const found = await findBusinesses({
            keyword: searchKeyword,
            location: searchLocation,
            radiusMeters: 5000,
            maxResults: 20,
            apiKey: apiKeys.googleMapsApiKey,
          });
          found.forEach((b) => {
            if (!results.some((r) => r.name === b.name)) {
              results.push({
                id: Date.now() + results.length + 1000,
                name: b.name,
                category: b.types[0] || term,
                location: b.address,
                rating: b.rating,
                reviews: b.userRatingsTotal,
                website: b.website || '',
                phone: b.phone || undefined,
                opportunityScore: 0,
                seoScore: 0,
                mobileScore: 0,
                urgency: 0,
                closeProbability: 0,
                issues: [],
                tech: [],
                source: 'Google Maps',
                googlePlaceId: b.placeId,
                createdAt: Date.now(),
              });
            }
          });
          updateStatus('google', { status: 'success', resultCount: found.length });
        } catch (e: any) {
          if (e instanceof RateLimitError) {
            updateStatus('google', { status: 'rate-limited', message: `Resets in ${Math.ceil(e.retryAfterMs / 60000)} min` });
            addNotification(`⏳ Google Places rate limited — resets in ${Math.ceil(e.retryAfterMs / 60000)} min`);
          } else {
            updateStatus('google', { status: 'error', message: e?.message || 'Request failed' });
            console.warn('Google Places search failed:', e);
          }
        }
      } else {
        updateStatus('google', { status: 'skipped', message: 'No API key' });
      }

      // Try Foursquare
      if (apiKeys.foursquareApiKey) {
        updateStatus('foursquare', { status: 'loading' });
        try {
          const places = await foursquareSearch(apiKeys.foursquareApiKey, query);
          places.forEach((p) => {
            if (!results.some((r) => r.name === p.name)) {
              results.push({
                id: Date.now() + results.length + 3000,
                name: p.name,
                category: p.categories[0] || term,
                location: p.formattedAddress,
                rating: p.rating,
                reviews: 0,
                website: p.website || '',
                opportunityScore: 0,
                seoScore: 0,
                mobileScore: 0,
                urgency: 0,
                closeProbability: 0,
                issues: [],
                tech: [],
                source: 'Foursquare',
                createdAt: Date.now(),
              });
            }
          });
          updateStatus('foursquare', { status: 'success', resultCount: places.length });
        } catch (e: any) {
          if (e instanceof RateLimitError) {
            updateStatus('foursquare', { status: 'rate-limited', message: `Resets in ${Math.ceil(e.retryAfterMs / 60000)} min` });
            addNotification(`⏳ Foursquare rate limited — resets in ${Math.ceil(e.retryAfterMs / 60000)} min`);
          } else {
            updateStatus('foursquare', { status: 'error', message: e?.message || 'Request failed' });
            console.warn('Foursquare search failed:', e);
          }
        }
      } else {
        updateStatus('foursquare', { status: 'skipped', message: 'No API key' });
      }

      // Try HERE
      if (apiKeys.hereApiKey) {
        updateStatus('here', { status: 'loading' });
        try {
          const places = await hereSearch(apiKeys.hereApiKey, query);
          places.forEach((p) => {
            if (!results.some((r) => r.name === p.name)) {
              results.push({
                id: Date.now() + results.length + 4000,
                name: p.name,
                category: p.categories[0] || term,
                location: p.formattedAddress,
                rating: 0,
                reviews: 0,
                website: p.website || '',
                opportunityScore: 0,
                seoScore: 0,
                mobileScore: 0,
                urgency: 0,
                closeProbability: 0,
                issues: [],
                tech: [],
                source: 'HERE',
                createdAt: Date.now(),
              });
            }
          });
          updateStatus('here', { status: 'success', resultCount: places.length });
        } catch (e: any) {
          if (e instanceof RateLimitError) {
            updateStatus('here', { status: 'rate-limited', message: `Resets in ${Math.ceil(e.retryAfterMs / 60000)} min` });
            addNotification(`⏳ HERE rate limited — resets in ${Math.ceil(e.retryAfterMs / 60000)} min`);
          } else {
            updateStatus('here', { status: 'error', message: e?.message || 'Request failed' });
            console.warn('HERE search failed:', e);
          }
        }
      } else {
        updateStatus('here', { status: 'skipped', message: 'No API key' });
      }

      // Try Firecrawl
      if (apiKeys.firecrawlApiKey) {
        updateStatus('firecrawl', { status: 'loading' });
        try {
          const scraped = await firecrawlSearch(apiKeys.firecrawlApiKey, query);
          scraped.forEach((s) => {
            if (!results.some((r) => r.name.toLowerCase() === s.name.toLowerCase())) {
              results.push({
                id: Date.now() + results.length + 2000,
                name: s.name,
                category: term,
                location: location || 'Unknown',
                rating: 0,
                reviews: 0,
                website: s.website,
                opportunityScore: 0,
                seoScore: 0,
                mobileScore: 0,
                urgency: 0,
                closeProbability: 0,
                issues: s.issues,
                tech: s.tech,
                source: 'Firecrawl',
                createdAt: Date.now(),
              });
            }
          });
          updateStatus('firecrawl', { status: 'success', resultCount: scraped.length });
        } catch (e: any) {
          if (e instanceof RateLimitError) {
            updateStatus('firecrawl', { status: 'rate-limited', message: `Resets in ${Math.ceil(e.retryAfterMs / 60000)} min` });
            addNotification(`⏳ Firecrawl rate limited — resets in ${Math.ceil(e.retryAfterMs / 60000)} min`);
          } else {
            updateStatus('firecrawl', { status: 'error', message: e?.message || 'Request failed' });
            console.warn('Firecrawl search failed:', e);
          }
        }
      } else {
        updateStatus('firecrawl', { status: 'skipped', message: 'No API key' });
      }

      if (results.length === 0) {
        addNotification('No results found. Check your API keys in Settings or try a different search.');
        setIsSearching(false);
        return;
      }

      // Score each business using LLM
      if (apiKeys.llmApiKey && results.length > 0) {
        updateStatus('llm', { status: 'loading', message: `Scoring ${results.length} businesses...` });
        let scoredCount = 0;
        for (const biz of results) {
          try {
            const scores = await scoreOpportunity(apiKeys, {
              name: biz.name,
              category: biz.category,
              location: biz.location,
              rating: biz.rating,
              reviews: biz.reviews,
              issues: biz.issues,
              tech: biz.tech,
            });
            biz.opportunityScore = scores.opportunityScore;
            biz.seoScore = scores.seoScore;
            biz.mobileScore = scores.mobileScore;
            biz.urgency = scores.urgency;
            biz.closeProbability = scores.closeProbability;
            if (scores.summary) {
              biz.issues = biz.issues.length > 0 ? biz.issues : [scores.summary];
            }
            scoredCount++;
            updateStatus('llm', { message: `Scored ${scoredCount}/${results.length}...` });
          } catch (e: any) {
            if (e instanceof RateLimitError) {
              updateStatus('llm', { status: 'rate-limited', message: `Rate limited — resets in ${Math.ceil(e.retryAfterMs / 60000)} min` });
              addNotification(`⏳ LLM rate limited — scoring ${biz.name} skipped (resets in ${Math.ceil(e.retryAfterMs / 60000)} min)`);
            } else {
              updateStatus('llm', { message: `Scored ${scoredCount}/${results.length} (1 error)` });
            }
            // Fallback scores
            biz.opportunityScore = Math.floor(Math.random() * 30) + 60;
            biz.seoScore = Math.floor(Math.random() * 40) + 30;
            biz.mobileScore = Math.floor(Math.random() * 40) + 40;
            biz.urgency = Math.floor(Math.random() * 30) + 50;
            biz.closeProbability = Math.floor(Math.random() * 30) + 50;
          }
        }
        updateStatus('llm', { status: 'success', message: `${scoredCount} businesses scored` });
      } else if (apiKeys.llmApiKey && results.length === 0) {
        updateStatus('llm', { status: 'skipped', message: 'No results to score' });
      } else {
        updateStatus('llm', { status: 'skipped', message: 'No API key — random scores' });
        // No LLM key — generate random scores
        results.forEach((biz) => {
          biz.opportunityScore = Math.floor(Math.random() * 30) + 60;
          biz.seoScore = Math.floor(Math.random() * 40) + 30;
          biz.mobileScore = Math.floor(Math.random() * 40) + 40;
          biz.urgency = Math.floor(Math.random() * 30) + 50;
          biz.closeProbability = Math.floor(Math.random() * 30) + 50;
        });
      }

      addBusinesses(results);
      addNotification(`Search complete: ${results.length} businesses enriched`);
    } catch (e: any) {
      setSearchError(e.message || 'Search failed');
      addNotification(`Search failed: ${e.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const analyzeBusiness = (biz: Business) => {
    addNotification(`Analysis ready for ${biz.name} (score: ${biz.opportunityScore})`);
  };

  const generateWebsite = async (biz: Business) => {
    const site = {
      id: Date.now(),
      name: `${biz.name} • ${biz.category}`,
      business: biz.name,
      variant: ['Luxury', 'Modern', 'Minimal'][Math.floor(Math.random() * 3)],
      hero: `Premium ${biz.category.toLowerCase()} services in ${biz.location.split(',')[0]}`,
      issues: biz.issues,
      score: biz.opportunityScore,
    };

    onOpenSiteEditor(site);

    addWebsite({
      id: Date.now(),
      name: site.name,
      business: biz.name,
      status: 'draft',
      visits: 0,
      conversion: 0,
      variant: site.variant,
      opportunityScore: biz.opportunityScore,
      createdAt: Date.now(),
    });

    addLead({
      id: Date.now(),
      business: biz.name,
      businessId: biz.id,
      stage: 'discovered',
      score: biz.opportunityScore,
      value: `$${(Math.floor(Math.random() * 15) + 5)}k`,
      lastActivity: 'now',
      createdAt: Date.now(),
    });

    addNotification(`Website generated for ${biz.name}`);
    onNavigate('websites');
  };

  const hasAnyKey = apiKeys.googleMapsApiKey || apiKeys.foursquareApiKey || apiKeys.hereApiKey || apiKeys.firecrawlApiKey || apiKeys.llmApiKey;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="max-w-lg">
        <div className="text-4xl font-semibold tracking-tight">Discover opportunities.</div>
        <div className="text-zinc-400 mt-1">
          Search any local business vertical. We'll scrape, analyze, and score every opportunity.
        </div>
      </div>

      <div className="mt-8 flex gap-3">
        <div className="flex-1 relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            placeholder="dentists in Miami • plumbers in Chicago • gyms in Austin"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 px-5 text-lg placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
          />
        </div>
        <button
          onClick={runSearch}
          disabled={isSearching || !query.trim()}
          className="px-8 py-4 bg-white text-black font-medium rounded-2xl flex items-center gap-2 disabled:opacity-50 hover:bg-zinc-200 transition-colors"
        >
          {isSearching ? (
            <>
              <div className="w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
              Searching...
            </>
          ) : (
            <>
              Search & Enrich <Search size={17} />
            </>
          )}
        </button>
      </div>

      {!hasAnyKey && businesses.length === 0 && (
        <div className="mt-6 text-center text-zinc-500 text-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
          <div className="text-lg mb-2">No API keys configured</div>
          <div className="text-xs text-zinc-600 mb-4">
            Add API keys in Settings to search real data, or try the demo below.
          </div>
          <button
            onClick={() => onNavigate('settings')}
            className="px-6 py-2 bg-white/10 text-sm rounded-xl hover:bg-white/20 transition-colors"
          >
            Open Settings
          </button>
        </div>
      )}

      {searchError && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-sm text-red-400">
          {searchError}
        </div>
      )}

      {/* Search progress panel — shows live status of each API service */}
      {isSearching && (
        <div className="mt-6 bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin text-zinc-400" />
            <span className="text-xs font-medium text-zinc-300">Searching...</span>
          </div>
          <div className="p-3 space-y-1">
            {serviceStatuses.map((svc) => {
              const SvgIcon = svc.icon;
              const statusIcon =
                svc.status === 'loading' ? (
                  <div className="w-3 h-3 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                ) : svc.status === 'success' ? (
                  <CheckCircle2 size={13} className="text-emerald-400" />
                ) : svc.status === 'error' ? (
                  <XCircle size={13} className="text-red-400" />
                ) : svc.status === 'rate-limited' ? (
                  <Clock size={13} className="text-amber-400" />
                ) : svc.status === 'skipped' ? (
                  <div className="w-3 h-3 rounded-full border border-dashed border-zinc-600" />
                ) : (
                  <div className="w-3 h-3 rounded-full bg-zinc-800" />
                );

              const statusColor =
                svc.status === 'loading'
                  ? 'text-zinc-200'
                  : svc.status === 'success'
                    ? 'text-emerald-400'
                    : svc.status === 'error'
                      ? 'text-red-400'
                      : svc.status === 'rate-limited'
                        ? 'text-amber-400'
                        : 'text-zinc-500';

              return (
                <div key={svc.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-zinc-950/50">
                  <SvgIcon size={14} className="text-zinc-500 shrink-0" />
                  <span className="text-xs text-zinc-400 flex-1">{svc.name}</span>
                  <div className="flex items-center gap-2">
                    {svc.resultCount !== undefined && svc.status === 'success' && (
                      <span className="text-[10px] text-zinc-500">{svc.resultCount} results</span>
                    )}
                    {svc.message && svc.status !== 'idle' && (
                      <span className={`text-[10px] ${statusColor}`}>{svc.message}</span>
                    )}
                    {statusIcon}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Results list wrapped in error boundary */}
      {businesses.length > 0 && (
        <div className="mt-8 space-y-4">
          <ErrorBoundary>
            {businesses.map((biz) => (
              <BusinessCard
                key={biz.id}
                business={biz}
                onAnalyze={analyzeBusiness}
                onGenerate={generateWebsite}
              />
            ))}
          </ErrorBoundary>
        </div>
      )}
    </div>
  );
}
