/**
 * Yelp data source — deprecated for static hosting.
 * Yelp's paid API is no longer used. Business data is sourced from
 * Google Places API (free $200/mo credit) and Firecrawl instead.
 *
 * Kept as a stub to prevent import errors — search results now
 * come from the Discover page's other data sources.
 */
export const rateLimiter = {
  updateConfig: () => {},
  acquire: async () => {},
  reset: () => {},
  stats: () => ({ currentRpm: 0, currentRpd: 0, resetAfterMs: 0 }),
};
