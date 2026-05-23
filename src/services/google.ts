import { createRateLimiter } from '../utils/rateLimiter';

const GOOGLE_PLACES_API = 'https://maps.googleapis.com/maps/api';

export const rateLimiter = createRateLimiter('Google Places', { rpm: 10, rpd: 100000 });

export interface GooglePlace {
  placeId: string;
  name: string;
  formattedAddress: string;
  rating: number;
  userRatingsTotal: number;
  website?: string;
  types: string[];
  photos?: string[];
  phone?: string;
  location?: { lat: number; lng: number };
}

// ── Geocoding ──

async function geocodeLocation(
  location: string,
  apiKey: string
): Promise<{ lat: number; lng: number }> {
  await rateLimiter.acquire();

  const response = await fetch(
    `${GOOGLE_PLACES_API}/geocode/json?address=${encodeURIComponent(location)}&key=${apiKey}`
  );

  if (!response.ok) {
    throw new Error(`Geocoding request failed (${response.status})`);
  }

  const data = await response.json();

  if (data.status !== 'OK' || !data.results?.length) {
    throw new Error(`Geocoding failed: ${data.status} - ${data.error_message || 'Location not found'}`);
  }

  return data.results[0].geometry.location;
}

// ── Nearby Search (paginated) ──

async function nearbySearch(
  params: {
    lat: number;
    lng: number;
    radiusMeters: number;
    keyword?: string;
    type?: string;
    pageToken?: string;
    apiKey: string;
  }
): Promise<{
  results: any[];
  nextPageToken: string | null;
}> {
  const { lat, lng, radiusMeters, keyword, type, pageToken, apiKey } = params;

  await rateLimiter.acquire();

  const queryParams = new URLSearchParams({
    location: `${lat},${lng}`,
    radius: String(radiusMeters),
    key: apiKey,
  });
  if (keyword) queryParams.set('keyword', keyword);
  if (type) queryParams.set('type', type);
  if (pageToken) queryParams.set('pagetoken', pageToken);

  const response = await fetch(
    `${GOOGLE_PLACES_API}/place/nearbysearch/json?${queryParams}`
  );

  if (!response.ok) {
    throw new Error(`Nearby search request failed (${response.status})`);
  }

  const data = await response.json();

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Places search failed: ${data.status} - ${data.error_message || ''}`);
  }

  return {
    results: data.results || [],
    nextPageToken: data.next_page_token || null,
  };
}

// ── Place Details ──

export async function getPlaceDetails(
  apiKey: string,
  placeId: string
): Promise<{
  website?: string;
  formattedPhoneNumber?: string;
  internationalPhoneNumber?: string;
  formattedAddress?: string;
  types?: string[];
  geometry?: { location: { lat: number; lng: number } };
}> {
  if (!apiKey) return {};

  await rateLimiter.acquire();

  const response = await fetch(
    `${GOOGLE_PLACES_API}/place/details/json?place_id=${placeId}&fields=name,website,formatted_address,formatted_phone_number,international_phone_number,types,geometry,rating,user_ratings_total&key=${apiKey}`
  );

  if (!response.ok) return {};

  const data = await response.json();
  if (data.status !== 'OK') return {};

  return {
    website: data.result?.website,
    formattedPhoneNumber: data.result?.formatted_phone_number,
    internationalPhoneNumber: data.result?.international_phone_number,
    formattedAddress: data.result?.formatted_address,
    types: data.result?.types,
    geometry: data.result?.geometry,
  };
}

// ── Full business discovery (Geocode → Nearby Search → Place Details) ──

export interface FindBusinessesParams {
  keyword: string;
  location: string;
  radiusMeters?: number;
  maxResults?: number;
  apiKey: string;
}

export interface FoundBusiness {
  name: string;
  address: string;
  phone: string | null;
  placeId: string;
  types: string[];
  rating: number;
  userRatingsTotal: number;
  website: string | null;
  location: { lat: number; lng: number } | null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Find businesses using the same approach as rake-v2-main:
 * 1. Geocode location → lat/lng
 * 2. Nearby search (paginated) for businesses matching keyword
 * 3. Fetch place details for each result
 * 4. Return enriched business data
 */
export async function findBusinesses(
  params: FindBusinessesParams
): Promise<FoundBusiness[]> {
  const {
    keyword,
    location,
    radiusMeters = 5000,
    maxResults = 20,
    apiKey,
  } = params;

  if (!apiKey) {
    throw new Error('Google Maps API key not configured. Add it in Settings.');
  }

  // Step 1: Geocode the location
  const coords = await geocodeLocation(location, apiKey);

  // Step 2 + 3: Nearby search with pagination + place details
  const businesses: FoundBusiness[] = [];
  const seenPlaceIds = new Set<string>();
  let pageToken: string | null = null;

  do {
    if (pageToken) {
      // Google requires a ~2s delay between paginated requests
      await sleep(2000);
    }

    const searchData = await nearbySearch({
      lat: coords.lat,
      lng: coords.lng,
      radiusMeters,
      keyword,
      pageToken: pageToken || undefined,
      apiKey,
    });

    for (const result of searchData.results) {
      if (businesses.length >= maxResults) break;
      if (!result.place_id || seenPlaceIds.has(result.place_id)) continue;

      seenPlaceIds.add(result.place_id);

      // Fetch place details for enriched data (website, phone, etc.)
      const details = await getPlaceDetails(apiKey, result.place_id);

      businesses.push({
        name: result.name,
        address: details.formattedAddress || result.vicinity || '',
        phone: details.internationalPhoneNumber || details.formattedPhoneNumber || null,
        placeId: result.place_id,
        types: details.types || result.types || [],
        rating: result.rating || 0,
        userRatingsTotal: result.user_ratings_total || 0,
        website: details.website || null,
        location: details.geometry?.location || result.geometry?.location || null,
      });
    }

    if (businesses.length >= maxResults) break;
    pageToken = searchData.nextPageToken;
  } while (pageToken);

  return businesses;
}

// ── Simple text search (original, kept for backward compatibility) ──

/** Search for places using Google Places Text Search API */
export async function searchPlaces(
  apiKey: string,
  query: string
): Promise<GooglePlace[]> {
  if (!apiKey) {
    throw new Error('Google Maps API key not configured. Add it in Settings.');
  }

  await rateLimiter.acquire();

  const response = await fetch(
    `${GOOGLE_PLACES_API}/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`
  );

  if (!response.ok) {
    throw new Error(`Google Places API error (${response.status})`);
  }

  const data = await response.json();

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Places API error: ${data.status} - ${data.error_message || ''}`);
  }

  return (data.results || []).map((place: any) => ({
    placeId: place.place_id,
    name: place.name,
    formattedAddress: place.formatted_address,
    rating: place.rating || 0,
    userRatingsTotal: place.user_ratings_total || 0,
    website: place.website || place.url,
    types: place.types || [],
    photos: place.photos?.slice(0, 3).map((p: any) =>
      `${GOOGLE_PLACES_API}/place/photo?maxwidth=400&photoreference=${p.photo_reference}&key=${apiKey}`
    ) || [],
  }));
}

// ── API Key verification ──

export async function verifyMapsApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  try {
    await geocodeLocation('Miami, FL', apiKey);
    return true;
  } catch {
    return false;
  }
}
