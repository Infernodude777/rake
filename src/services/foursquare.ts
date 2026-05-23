import { createRateLimiter } from '../utils/rateLimiter';

const FOURSQUARE_API = 'https://api.foursquare.com/v3/places';

export const rateLimiter = createRateLimiter('Foursquare', { rpm: 10, rpd: 5000 });

export interface FoursquarePlace {
  fsqId: string;
  name: string;
  formattedAddress: string;
  categories: string[];
  rating: number;
  website?: string;
  tel?: string;
  latitude: number;
  longitude: number;
  photos?: string[];
}

/** Search for places using Foursquare Places API v3 */
export async function searchPlaces(
  apiKey: string,
  query: string
): Promise<FoursquarePlace[]> {
  if (!apiKey) {
    throw new Error('Foursquare API key not configured. Add it in Settings.');
  }

  await rateLimiter.acquire();

  // Pass the natural query — Foursquare handles "dentists in Miami" natively
  const params = new URLSearchParams({
    query: query,
    limit: '10',
    sort: 'RELEVANCE',
  });

  const response = await fetch(`${FOURSQUARE_API}/search?${params}`, {
    headers: {
      'Authorization': apiKey,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Foursquare API error: Invalid API key.');
    }
    throw new Error(`Foursquare API error (${response.status})`);
  }

  const data = await response.json();
  const results = data.results || [];

  return results.map((place: any) => ({
    fsqId: place.fsq_id,
    name: place.name,
    formattedAddress: place.location?.formatted_address || place.location?.address || '',
    categories: (place.categories || []).map((c: any) => c.name),
    rating: place.rating || 0,
    website: place.website || '',
    tel: place.tel || '',
    latitude: place.geocodes?.main?.latitude || place.geocodes?.latitude || 0,
    longitude: place.geocodes?.main?.longitude || place.geocodes?.longitude || 0,
    photos: place.photos?.slice(0, 3).map((p: any) =>
      `${p.prefix}original${p.suffix}`
    ) || [],
  }));
}
