import { createRateLimiter } from '../utils/rateLimiter';

const GOOGLE_PLACES_API = 'https://maps.googleapis.com/maps/api/place';

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
}

/** Search for places using Google Places API */
export async function searchPlaces(
  apiKey: string,
  query: string
): Promise<GooglePlace[]> {
  if (!apiKey) {
    throw new Error('Google Maps API key not configured. Add it in Settings.');
  }

  await rateLimiter.acquire();

  const response = await fetch(
    `${GOOGLE_PLACES_API}/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`
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
      `${GOOGLE_PLACES_API}/photo?maxwidth=400&photoreference=${p.photo_reference}&key=${apiKey}`
    ) || [],
  }));
}

/** Get detailed place info including website */
export async function getPlaceDetails(
  apiKey: string,
  placeId: string
): Promise<{ website?: string; formattedPhoneNumber?: string; openingHours?: string[] }> {
  if (!apiKey) return {};

  await rateLimiter.acquire();

  const response = await fetch(
    `${GOOGLE_PLACES_API}/details/json?place_id=${placeId}&fields=website,formatted_phone_number,opening_hours&key=${apiKey}`
  );

  if (!response.ok) return {};

  const data = await response.json();
  if (data.status !== 'OK') return {};

  return {
    website: data.result?.website,
    formattedPhoneNumber: data.result?.formatted_phone_number,
    openingHours: data.result?.opening_hours?.weekday_text,
  };
}
