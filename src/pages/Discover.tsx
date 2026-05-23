import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { useData } from '../context/DataContext';
import { searchBusinesses as firecrawlSearch, rateLimiter as firecrawlLimiter } from '../services/firecrawl';
import { searchBusinesses as yelpSearch, rateLimiter as yelpLimiter } from '../services/yelp';
import { searchPlaces, rateLimiter as googleLimiter } from '../services/google';
import { scoreOpportunity, rateLimiter as llmLimiter } from '../services/llm';
import { RateLimitError } from '../utils/rateLimiter';
import BusinessCard from '../components/BusinessCard';
import type { Business } from '../types';

interface DiscoverProps {
  onNavigate: (page: string) => void;
  onOpenSiteEditor: (site: any) => void;
}

export default function Discover({ onNavigate, onOpenSiteEditor }: DiscoverProps) {
  const { apiKeys, addBusinesses, businesses, addLead, addWebsite, addNotification, settings } = useData();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Sync rate limiter configs from user settings
  useEffect(() => {
    if (settings.rateLimits) {
      yelpLimiter.updateConfig(settings.rateLimits.yelp);
      googleLimiter.updateConfig(settings.rateLimits.google);
      firecrawlLimiter.updateConfig(settings.rateLimits.firecrawl);
      llmLimiter.updateConfig(settings.rateLimits.llm);
    }
  }, [settings.rateLimits]);

  const runSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setSearchError('');

    try {
      const results: Business[] = [];
      const queryLower = query.toLowerCase();

      // Parse query: "dentists in miami" → term: "dentists", location: "miami"
      const parts = queryLower.split(/\s+in\s+/);
      const term = parts[0] || queryLower;
      const location = parts[1] || '';

      // Try Yelp
      if (apiKeys.yelpApiKey) {
        try {
          const yelpResults = await yelpSearch(apiKeys.yelpApiKey, term, location || 'Miami');
          yelpResults.forEach((b) => {
            results.push({
              id: Date.now() + results.length,
              name: b.name,
              category: b.categories[0] || term,
              location: b.location,
              rating: b.rating,
              reviews: b.reviewCount,
              website: b.url,
              opportunityScore: 0,
              seoScore: 0,
              mobileScore: 0,
              urgency: 0,
              closeProbability: 0,
              issues: [],
              tech: [],
              source: 'Yelp',
              createdAt: Date.now(),
            });
          });
        } catch (e: any) {
          if (e instanceof RateLimitError) {
            addNotification(`⏳ Yelp rate limited — resets in ${Math.ceil(e.retryAfterMs / 60000)} min`);
          } else {
            console.warn('Yelp search failed:', e);
          }
        }
      }

      // Try Google Places
      if (apiKeys.googleMapsApiKey) {
        try {
          const places = await searchPlaces(apiKeys.googleMapsApiKey, query);
          places.forEach((p) => {
            if (!results.some((r) => r.name === p.name)) {
              results.push({
                id: Date.now() + results.length + 1000,
                name: p.name,
                category: p.types[0] || term,
                location: p.formattedAddress,
                rating: p.rating,
                reviews: p.userRatingsTotal,
                website: p.website || '',
                opportunityScore: 0,
                seoScore: 0,
                mobileScore: 0,
                urgency: 0,
                closeProbability: 0,
                issues: [],
                tech: [],
                source: 'Google Maps',
                googlePlaceId: p.placeId,
                createdAt: Date.now(),
              });
            }
          });
        } catch (e: any) {
          if (e instanceof RateLimitError) {
            addNotification(`⏳ Google Places rate limited — resets in ${Math.ceil(e.retryAfterMs / 60000)} min`);
          } else {
            console.warn('Google Places search failed:', e);
          }
        }
      }

      // Try Firecrawl
      if (apiKeys.firecrawlApiKey) {
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
        } catch (e: any) {
          if (e instanceof RateLimitError) {
            addNotification(`⏳ Firecrawl rate limited — resets in ${Math.ceil(e.retryAfterMs / 60000)} min`);
          } else {
            console.warn('Firecrawl search failed:', e);
          }
        }
      }

      if (results.length === 0) {
        addNotification('No results found. Check your API keys in Settings or try a different search.');
        setIsSearching(false);
        return;
      }

      // Score each business using LLM
      if (apiKeys.llmApiKey) {
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
          } catch (e: any) {
            if (e instanceof RateLimitError) {
              addNotification(`⏳ LLM rate limited — scoring ${biz.name} skipped (resets in ${Math.ceil(e.retryAfterMs / 60000)} min)`);
            }
            // Fallback scores
            biz.opportunityScore = Math.floor(Math.random() * 30) + 60;
            biz.seoScore = Math.floor(Math.random() * 40) + 30;
            biz.mobileScore = Math.floor(Math.random() * 40) + 40;
            biz.urgency = Math.floor(Math.random() * 30) + 50;
            biz.closeProbability = Math.floor(Math.random() * 30) + 50;
          }
        }
      } else {
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

  const hasAnyKey = apiKeys.yelpApiKey || apiKeys.googleMapsApiKey || apiKeys.firecrawlApiKey || apiKeys.llmApiKey;

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

      {businesses.length > 0 && (
        <div className="mt-8 space-y-4">
          {businesses.map((biz) => (
            <BusinessCard
              key={biz.id}
              business={biz}
              onAnalyze={analyzeBusiness}
              onGenerate={generateWebsite}
            />
          ))}
        </div>
      )}
    </div>
  );
}
