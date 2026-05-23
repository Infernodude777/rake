import { createRateLimiter } from '../utils/rateLimiter';

export const GOOGLE_PLACES_API = 'https://maps.googleapis.com/maps/api';
const GOOGLE_MAPS_JS = 'https://maps.googleapis.com/maps/api/js';

export const rateLimiter = createRateLimiter('Google Places', { rpm: 300, rpd: 100000 });

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

// ── Google Maps JS API loader (browser-safe, no CORS issues) ──

let googleInstance: typeof google | null = null;
let loadedApiKey = '';
let loadPromise: Promise<typeof google> | null = null;

async function getGoogleMaps(apiKey: string): Promise<typeof google> {
  if (!apiKey) throw new Error('Google Maps API key not configured. Add it in Settings.');

  // If key changed, force reload by clearing state
  if (loadedApiKey !== apiKey) {
    loadedApiKey = '';
    googleInstance = null;
    loadPromise = null;
    // Remove old hidden div (PlacesService DOM element)
    if (placesDiv) { placesDiv.remove(); placesDiv = null; }
    // Remove old Google Maps script tags
    document.querySelectorAll('script[data-rake-gmaps]').forEach((el) => el.remove());
    delete (window as any).google;
  }

  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        loadPromise = null;
        reject(new Error('Google Maps API load timed out. Check your key and billing.'));
      }, 15000);

      const callbackName = `__gmp_${Date.now()}`;
      (window as any)[callbackName] = () => {
        clearTimeout(timeout);
        googleInstance = (window as any).google;
        loadedApiKey = apiKey;
        resolve(googleInstance!);
        delete (window as any)[callbackName];
      };

      const script = document.createElement('script');
      script.src = `${GOOGLE_MAPS_JS}?key=${apiKey}&libraries=places&callback=${callbackName}`;
      script.setAttribute('data-rake-gmaps', '1');
      script.async = true;
      script.onerror = () => {
        clearTimeout(timeout);
        loadPromise = null;
        reject(new Error('Failed to load Google Maps API. Check your key and billing.'));
      };
      document.head.appendChild(script);
    });
  }

  return loadPromise;
}

// ── PlacesService & Geocoder helpers ──

let placesDiv: HTMLDivElement | null = null;

function getPlacesService(g: typeof google): google.maps.places.PlacesService {
  if (!placesDiv) {
    placesDiv = document.createElement('div');
    placesDiv.style.display = 'none';
    document.body.appendChild(placesDiv);
  }
  return new g.maps.places.PlacesService(placesDiv);
}

function promisifyTextSearch(
  service: google.maps.places.PlacesService,
  request: google.maps.places.TextSearchRequest
): Promise<google.maps.places.PlaceResult[]> {
  return new Promise((resolve, reject) => {
    service.textSearch(request, (results, status) => {
      if (status === 'OK' || status === 'ZERO_RESULTS') resolve(results || []);
      else reject(new Error(`Text search failed: ${status}`));
    });
  });
}

function promisifyGetDetails(
  service: google.maps.places.PlacesService,
  placeId: string,
  fields: string[]
): Promise<google.maps.places.PlaceResult> {
  return new Promise((resolve, reject) => {
    service.getDetails({ placeId, fields }, (result, status) => {
      if (status === 'OK' && result) resolve(result);
      else reject(new Error(`Place details failed: ${status}`));
    });
  });
}

/** Collect paginated nearby search results (repeated callback pattern). */
async function collectNearbyResults(
  service: google.maps.places.PlacesService,
  request: google.maps.places.PlaceSearchRequest,
  maxResults: number
): Promise<google.maps.places.PlaceResult[]> {
  const all: google.maps.places.PlaceResult[] = [];

  return new Promise((resolve, reject) => {
    let rejected = false;

    const callback = (
      results: google.maps.places.PlaceResult[] | null,
      status: 'OK' | 'INVALID_REQUEST' | 'NOT_FOUND' | 'OVER_QUERY_LIMIT' | 'REQUEST_DENIED' | 'UNKNOWN_ERROR' | 'ZERO_RESULTS',
      pagination: google.maps.places.PlaceSearchPagination | null
    ) => {
      if (rejected) return;

      if (status === 'OK' && results) {
        all.push(...results);

        if (all.length >= maxResults || !pagination?.hasNextPage) {
          resolve(all.slice(0, maxResults));
        } else {
          // Google requires ~2s delay between paginated requests
          setTimeout(() => pagination.nextPage(), 2000);
        }
      } else if (status === 'ZERO_RESULTS') {
        resolve([]);
      } else {
        rejected = true;
        reject(new Error(`Nearby search failed: ${status}`));
      }
    };

    service.nearbySearch(request, callback);
  });
}

// ── Geocoding ──

async function geocodeLocation(location: string, g: typeof google): Promise<{ lat: number; lng: number }> {
  const geocoder = new g.maps.Geocoder();

  return new Promise((resolve, reject) => {
    geocoder.geocode({ address: location }, (results, status) => {
      if (status === 'OK' && results?.[0]?.geometry?.location) {
        const loc = results[0].geometry.location;
        resolve({ lat: loc.lat(), lng: loc.lng() });
      } else {
        reject(new Error(`Geocoding failed: ${status} — Location not found`));
      }
    });
  });
}

// ── Public API ──

/** Search for places using Google Places Text Search (via JS API). */
export async function searchPlaces(apiKey: string, query: string): Promise<GooglePlace[]> {
  const g = await getGoogleMaps(apiKey);
  const service = getPlacesService(g);

  await rateLimiter.acquire();

  const results = await promisifyTextSearch(service, { query });

  return (results || []).map((p) => ({
    placeId: p.place_id || '',
    name: p.name || '',
    formattedAddress: p.formatted_address || '',
    rating: p.rating || 0,
    userRatingsTotal: p.user_ratings_total || 0,
    website: p.website || p.url,
    types: p.types || [],
    photos:
      p.photos
        ?.slice(0, 3)
        .map((photo) => photo.getUrl({ maxWidth: 400 })) || [],
    phone: p.international_phone_number || p.formatted_phone_number,
    location: p.geometry?.location
      ? { lat: p.geometry.location.lat(), lng: p.geometry.location.lng() }
      : undefined,
  }));
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

/**
 * Find businesses using Google Maps JS API (browser-safe):
 * 1. Geocode location → lat/lng
 * 2. Nearby search (paginated) for businesses matching keyword
 * 3. Fetch place details for each result
 * 4. Return enriched business data
 */
export async function findBusinesses(
  params: FindBusinessesParams
): Promise<FoundBusiness[]> {
  const { keyword, location, radiusMeters = 5000, maxResults = 20, apiKey } = params;

  const g = await getGoogleMaps(apiKey);
  const service = getPlacesService(g);

  await rateLimiter.acquire();

  // Step 1: Geocode the location
  const coords = await geocodeLocation(location, g);

  // Step 2: Collect paginated nearby search results
  const places = await collectNearbyResults(
    service,
    {
      location: new g.maps.LatLng(coords.lat, coords.lng),
      radius: radiusMeters,
      keyword,
    },
    maxResults
  );

  // Step 3: Fetch place details in parallel batches (website, phone, etc.)
  const businesses: FoundBusiness[] = [];
  const seenPlaceIds = new Set<string>();
  const uniquePlaces = places.filter((p) => p.place_id && !seenPlaceIds.has(p.place_id) && seenPlaceIds.add(p.place_id));

  const BATCH_SIZE = 5;
  for (let i = 0; i < uniquePlaces.length; i += BATCH_SIZE) {
    const batch = uniquePlaces.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (place) => {
        let details: google.maps.places.PlaceResult | null = null;
        try {
          await rateLimiter.acquire();
          details = await promisifyGetDetails(service, place.place_id!, [
            'name',
            'website',
            'formatted_address',
            'formatted_phone_number',
            'international_phone_number',
            'types',
            'geometry',
            'rating',
            'user_ratings_total',
          ]);
        } catch {
          // If details fail, use nearby search data
        }

        const loc = place.geometry?.location;
        return {
          name: place.name || '',
          address: details?.formatted_address || place.vicinity || '',
          phone:
            details?.international_phone_number ||
            details?.formatted_phone_number ||
            null,
          placeId: place.place_id!,
          types: details?.types || place.types || [],
          rating: place.rating || 0,
          userRatingsTotal: place.user_ratings_total || 0,
          website: details?.website || null,
          location: loc ? { lat: loc.lat(), lng: loc.lng() } : null,
        };
      })
    );
    businesses.push(...batchResults);
  }

  return businesses;
}


