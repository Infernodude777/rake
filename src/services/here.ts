import { createRateLimiter } from '../utils/rateLimiter';

export const rateLimiter = createRateLimiter('HERE', { rpm: 20, rpd: 100000 });

export interface HerePlace {
  id: string;
  name: string;
  formattedAddress: string;
  categories: string[];
  website?: string;
  phone?: string;
  latitude: number;
  longitude: number;
}

/**
 * Search for places using HERE Geocoding & Search API v7.
 * Has a generous free tier of 250k transactions/month.
 */
export async function searchPlaces(
  apiKey: string,
  query: string
): Promise<HerePlace[]> {
  if (!apiKey) {
    throw new Error('HERE API key not configured. Add it in Settings.');
  }

  await rateLimiter.acquire();

  // Parse "dentists in Miami" into query + location parts, then
  // let HERE's natural language search handle both together
  const searchText = query.replace(/\s+in\s+/i, ' in ');

  const params = new URLSearchParams({
    q: searchText,
    apiKey: apiKey,
    limit: '10',
  });

  const response = await fetch(`https://discover.search.hereapi.com/v1/discover?${params}`);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('HERE API error: Invalid API key.');
    }
    throw new Error(`HERE API error (${response.status})`);
  }

  const data = await response.json();
  return parseResults(data);
}

function parseResults(data: any): HerePlace[] {
  const items = data.items || [];
  return items.map((item: any) => {
    const address = item.address || {};
    const contacts = item.contacts?.[0] || {};

    return {
      id: item.id,
      name: item.title,
      formattedAddress: address.label || [
        address.street,
        address.city,
        address.countryName,
      ].filter(Boolean).join(', '),
      categories: (item.categories || []).map((c: any) => c.name),
      website: contacts.www?.[0]?.value || '',
      phone: contacts.phone?.[0]?.value || '',
      latitude: item.position?.lat || 0,
      longitude: item.position?.lng || 0,
    };
  });
}
