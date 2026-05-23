import { useState, useEffect, useCallback } from 'react';
import { Search, MapPin, Zap, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import { findBusinesses, searchPlaces, rateLimiter as googleLimiter } from '../services/google';
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
  { id: 'llm', name: 'AI Enrichment', icon: Zap },
] as const;

function escapeCSV(val: string | number): string {
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

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
      const queryLower = query.trim();

      // Parse query: "dentists in miami" → term: "dentists", location: "miami"
      const parts = queryLower.split(/\s+in\s+/);
      const term = parts[0] || queryLower;
      const location = parts[1] || '';

      // ── Google Places Search ──
      if (apiKeys.googleMapsApiKey) {
        updateStatus('google', { status: 'loading', message: 'Searching...' });

        // Helpers to normalize and merge results
        const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
        const seen = new Set<string>();

        const addResult = (b: any) => {
          if (!b?.name) return;
          const key = normalize(b.name);
          if (seen.has(key)) {
            // Merge: prefer non-empty values from either source
            const cur = results[results.findIndex((r) => normalize(r.name) === key)];
            if (!cur) return;
            if (!cur.website && b.website) cur.website = b.website;
            if (!cur.phone && b.phone) cur.phone = b.phone;
            if (!cur.googlePlaceId && (b.placeId || b.place_id)) cur.googlePlaceId = b.placeId || b.place_id;
            if (b.rating > cur.rating) cur.rating = b.rating;
            if ((b.userRatingsTotal || 0) > cur.reviews) cur.reviews = b.userRatingsTotal || 0;
            return;
          }
          seen.add(key);
          results.push({
            id: Date.now() + results.length + 1000,
            name: b.name,
            category: (b.types && b.types[0]) || term,
            location: b.formattedAddress || b.address || location || term,
            rating: b.rating || 0,
            reviews: b.userRatingsTotal || 0,
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
            googlePlaceId: b.placeId || b.place_id,
            createdAt: Date.now(),
          });
        };

        try {
          if (location) {
            // Run both nearby search (geocoding) and text search in parallel
            updateStatus('google', { message: 'Running nearby + text search...' });
            const [nearbyResult, textResult] = await Promise.allSettled([
              findBusinesses({
                keyword: term,
                location,
                radiusMeters: 5000,
                maxResults: 20,
                apiKey: apiKeys.googleMapsApiKey,
              }).then((r) => ({ source: 'nearby' as const, data: r })),
              searchPlaces(apiKeys.googleMapsApiKey, queryLower).then((r) => ({ source: 'text' as const, data: r })),
            ]);

            let nearbyCount = 0;
            let textCount = 0;

            if (nearbyResult.status === 'fulfilled') {
              nearbyResult.value.data.forEach(addResult);
              nearbyCount = nearbyResult.value.data.length;
            } else {
              console.warn('Nearby search failed:', nearbyResult.reason);
            }

            if (textResult.status === 'fulfilled') {
              textResult.value.data.forEach(addResult);
              textCount = textResult.value.data.length;
            } else {
              console.warn('Text search failed:', textResult.reason);
            }

            const combined = results.length;
            if (nearbyCount > 0 && textCount > 0) {
              updateStatus('google', {
                status: 'success',
                message: `Nearby: ${nearbyCount}, Text: ${textCount} → ${combined} unique`,
                resultCount: combined,
              });
            } else if (nearbyCount > 0) {
              updateStatus('google', { status: 'success', resultCount: nearbyCount });
            } else if (textCount > 0) {
              updateStatus('google', { status: 'success', resultCount: textCount });
            } else {
              // Both failed — report the first error
              const err = nearbyResult.status === 'rejected' ? nearbyResult.reason : textResult.status === 'rejected' ? textResult.reason : null;
              throw err || new Error('Both searches returned no results');
            }
          } else {
            // No location in query — use text search directly
            updateStatus('google', { message: 'Searching Google Places...' });
            const found = await searchPlaces(apiKeys.googleMapsApiKey, queryLower);
            found.forEach(addResult);
            updateStatus('google', { status: 'success', resultCount: found.length });
          }
        } catch (e: any) {
          if (e instanceof RateLimitError) {
            updateStatus('google', { status: 'rate-limited', message: `Resets in ${Math.ceil(e.retryAfterMs / 60000)} min` });
            addNotification(`⏳ Google Places rate limited — resets in ${Math.ceil(e.retryAfterMs / 60000)} min`);
          } else {
            const msg = e?.message || 'Request failed';
            updateStatus('google', { status: 'error', message: msg });
            addNotification(`Google search failed: ${msg}`);
          }
        }
      } else {
        updateStatus('google', { status: 'skipped', message: 'No API key' });
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
            biz.opportunityScore = scores.opportunityScore ?? 50;
            biz.seoScore = scores.seoScore ?? 50;
            biz.mobileScore = scores.mobileScore ?? 50;
            biz.urgency = scores.urgency ?? 50;
            biz.closeProbability = scores.closeProbability ?? 50;
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

  const exportCSV = useCallback(() => {
    if (businesses.length === 0) return;

    const headers = [
      'Name', 'Category', 'Location', 'Rating', 'Reviews',
      'Website', 'Phone', 'Source', 'Opp. Score', 'SEO Score',
      'Mobile Score', 'Urgency', 'Close %', 'Issues', 'Tech Stack',
    ];

    const rows = businesses.map((b) => [
      escapeCSV(b.name),
      escapeCSV(b.category),
      escapeCSV(b.location),
      b.rating,
      b.reviews,
      b.website,
      b.phone || '',
      b.source || '',
      b.opportunityScore,
      b.seoScore,
      b.mobileScore,
      b.urgency,
      b.closeProbability,
      escapeCSV(b.issues.join('; ')),
      escapeCSV(b.tech.join('; ')),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rake-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addNotification(`Exported ${businesses.length} businesses to CSV`);
  }, [businesses, addNotification]);

  const hasAnyKey = apiKeys.googleMapsApiKey || apiKeys.llmApiKey;

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

      {/* Results count + export button */}
      {businesses.length > 0 && (
        <div className="mt-8 flex items-center justify-between">
          <div className="text-sm text-zinc-500">
            {businesses.length} business{businesses.length !== 1 ? 'es' : ''} discovered
          </div>
          <button
            onClick={exportCSV}
            className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-400 hover:text-white hover:border-zinc-600 transition-all flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </button>
        </div>
      )}

      {/* Results list wrapped in error boundary */}
      {businesses.length > 0 && (
        <div className="mt-4 space-y-4">
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
