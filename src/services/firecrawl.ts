import { createRateLimiter } from '../utils/rateLimiter';

interface FirecrawlResult {
  name?: string;
  description?: string;
  url: string;
  metadata?: Record<string, string>;
}

interface ScrapedBusiness {
  name: string;
  website: string;
  description: string;
  issues: string[];
  tech: string[];
}

const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1';

export const rateLimiter = createRateLimiter('Firecrawl', { rpm: 3, rpd: 490 });

export async function searchBusinesses(
  apiKey: string,
  query: string
): Promise<ScrapedBusiness[]> {
  if (!apiKey) {
    throw new Error('Firecrawl API key not configured. Add it in Settings.');
  }

  await rateLimiter.acquire();

  // Use Firecrawl's map/search endpoint to find businesses
  const response = await fetch(`${FIRECRAWL_API_URL}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      searchOptions: {
        limit: 10,
      },
      pageOptions: {
        fetchPageContent: true,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Firecrawl error (${response.status}): ${error}`);
  }

  const data = await response.json();
  const results: FirecrawlResult[] = data.data || data.results || [];

  return results.map((r, index) => ({
    name: r.name || r.metadata?.['title'] || `Business ${index + 1}`,
    website: r.url || '',
    description: r.description || r.metadata?.['description'] || '',
    issues: detectIssues(r),
    tech: detectTech(r),
  }));
}

function detectIssues(result: FirecrawlResult): string[] {
  const issues: string[] = [];
  const content = (result.description || '').toLowerCase();
  const title = (result.metadata?.['title'] || '').toLowerCase();

  if (!title || title === 'home') issues.push('Weak page title');
  if (!result.description) issues.push('Missing meta description');
  if (content.includes('wordpress') || content.includes('wix') || content.includes('squarespace')) {
    issues.push('Generic template site');
  }

  return issues.length > 0 ? issues : ['Needs design review'];
}

function detectTech(result: FirecrawlResult): string[] {
  const tech: string[] = [];
  const metaKeys = Object.keys(result.metadata || {});
  if (metaKeys.some((k) => k.toLowerCase().includes('generator'))) {
    const gen = result.metadata?.['generator'];
    if (gen) tech.push(gen);
  }
  return tech.length > 0 ? tech : ['Unknown'];
}

/** Scrape a single URL for detailed analysis */
export async function scrapeUrl(apiKey: string, url: string): Promise<{
  title: string;
  description: string;
  content: string;
  screenshot?: string;
}> {
  if (!apiKey) {
    throw new Error('Firecrawl API key not configured.');
  }

  await rateLimiter.acquire();

  const response = await fetch(`${FIRECRAWL_API_URL}/scrape`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ['markdown', 'screenshot'],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Firecrawl scrape error (${response.status}): ${error}`);
  }

  const data = await response.json();
  return {
    title: data.data?.metadata?.title || '',
    description: data.data?.metadata?.description || '',
    content: data.data?.markdown || '',
    screenshot: data.data?.screenshot,
  };
}
