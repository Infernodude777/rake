import { createRateLimiter } from '../utils/rateLimiter';

const YELP_API = 'https://api.yelp.com/v3';

export const rateLimiter = createRateLimiter('Yelp', { rpm: 5, rpd: 290 });

export interface YelpBusiness {
  id: string;
  name: string;
  rating: number;
  reviewCount: number;
  location: string;
  categories: string[];
  phone: string;
  url: string;
  imageUrl?: string;
  price?: string;
}

/** Search businesses via Yelp Fusion API */
export async function searchBusinesses(
  apiKey: string,
  term: string,
  location: string
): Promise<YelpBusiness[]> {
  if (!apiKey) {
    throw new Error('Yelp API key not configured. Add it in Settings.');
  }

  await rateLimiter.acquire();

  const response = await fetch(
    `${YELP_API}/businesses/search?term=${encodeURIComponent(term)}&location=${encodeURIComponent(location)}&limit=10&sort_by=rating`,
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Yelp API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  return (data.businesses || []).map((biz: any) => ({
    id: biz.id,
    name: biz.name,
    rating: biz.rating || 0,
    reviewCount: biz.review_count || 0,
    location: [biz.location?.city, biz.location?.state].filter(Boolean).join(', '),
    categories: (biz.categories || []).map((c: any) => c.title),
    phone: biz.display_phone || '',
    url: biz.url || '',
    imageUrl: biz.image_url,
    price: biz.price,
  }));
}

/** Get detailed business info including reviews */
export async function getBusinessDetails(apiKey: string, yelpId: string): Promise<{
  name: string;
  rating: number;
  reviewCount: number;
  price?: string;
  phone?: string;
  url?: string;
  reviews?: { text: string; rating: number; user: string }[];
}> {
  if (!apiKey) return { name: '', rating: 0, reviewCount: 0 };

  await rateLimiter.acquire();

  const [detailsRes, reviewsRes] = await Promise.allSettled([
    fetch(`${YELP_API}/businesses/${yelpId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    }),
    fetch(`${YELP_API}/businesses/${yelpId}/reviews?limit=3`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    }),
  ]);

  let details: any = {};
  let reviews: any[] = [];

  if (detailsRes.status === 'fulfilled' && detailsRes.value.ok) {
    details = await detailsRes.value.json();
  }
  if (reviewsRes.status === 'fulfilled' && reviewsRes.value.ok) {
    const revData = await reviewsRes.value.json();
    reviews = revData.reviews || [];
  }

  return {
    name: details.name || '',
    rating: details.rating || 0,
    reviewCount: details.review_count || 0,
    price: details.price,
    phone: details.display_phone,
    url: details.url,
    reviews: reviews.map((r: any) => ({
      text: r.text,
      rating: r.rating,
      user: r.user?.name || 'Anonymous',
    })),
  };
}
