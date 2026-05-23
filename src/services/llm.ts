import type { ApiKeys } from '../types';
import { createRateLimiter } from '../utils/rateLimiter';

export const rateLimiter = createRateLimiter('LLM', { rpm: 300, rpd: 5000 });

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMResponse {
  content: string;
  model: string;
}

export async function chatCompletion(
  keys: ApiKeys,
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<LLMResponse> {
  if (!keys.llmApiKey) {
    throw new Error('LLM API key not configured. Add it in Settings.');
  }
  if (!keys.llmBaseUrl) {
    throw new Error('LLM base URL not configured. Add it in Settings.');
  }

  await rateLimiter.acquire();

  const baseUrl = keys.llmBaseUrl.replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${keys.llmApiKey}`,
    },
    body: JSON.stringify({
      model: keys.llmModelId,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 1024,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    model: data.model || keys.llmModelId,
  };
}

/** Score a business opportunity based on its data */
export async function scoreOpportunity(keys: ApiKeys, business: {
  name: string;
  category: string;
  location: string;
  rating: number;
  reviews: number;
  issues: string[];
  tech: string[];
}): Promise<{
  opportunityScore: number;
  seoScore: number;
  mobileScore: number;
  urgency: number;
  closeProbability: number;
  summary: string;
}> {
  const prompt = `You are an AI business analyst. Analyze this local business for a web agency's sales opportunity.

Business: ${business.name}
Category: ${business.category}
Location: ${business.location}
Rating: ${business.rating}★ (${business.reviews} reviews)
Detected Issues: ${business.issues.join(', ')}
Current Tech: ${business.tech.join(', ') || 'Unknown'}

Return a JSON object with:
- opportunityScore (0-100): How good this opportunity is
- seoScore (0-100): Current SEO quality
- mobileScore (0-100): Current mobile readiness
- urgency (0-100): How urgently they need a new site
- closeProbability (0-100): Likelihood of closing the deal
- summary: One-sentence analysis`;

  const response = await chatCompletion(keys, [
    { role: 'system', content: 'You are a business analyst. Return only valid JSON.' },
    { role: 'user', content: prompt },
  ], { temperature: 0.3 });

  try {
    const parsed = JSON.parse(response.content);
    return {
      opportunityScore: parsed.opportunityScore ?? 50,
      seoScore: parsed.seoScore ?? 50,
      mobileScore: parsed.mobileScore ?? 50,
      urgency: parsed.urgency ?? 50,
      closeProbability: parsed.closeProbability ?? 50,
      summary: parsed.summary ?? '',
    };
  } catch {
    return {
      opportunityScore: 50,
      seoScore: 50,
      mobileScore: 50,
      urgency: 50,
      closeProbability: 50,
      summary: 'Analysis unavailable',
    };
  }
}

/** Generate a personalized outreach email */
export async function generateOutreachEmail(keys: ApiKeys, business: {
  name: string;
  category: string;
  location: string;
  issues: string[];
  score: number;
}): Promise<string> {
  const prompt = `Write a short, personalized outreach email for a web agency to ${business.name}, a ${business.category} in ${business.location}.

Key issues with their current online presence: ${business.issues.join(', ')}
Our opportunity score: ${business.score}/100

The email should:
- Be friendly and personalized
- Reference specific issues we noticed
- Offer a free website audit
- Include a subtle call to action
- Be 3-4 short paragraphs
- Not sound like spam

Sign it as "Maya" from the agency team.`;

  const response = await chatCompletion(keys, [
    { role: 'system', content: 'You are a sales outreach specialist. Write concise, human emails.' },
    { role: 'user', content: prompt },
  ], { temperature: 0.8, maxTokens: 600 });

  return response.content;
}

/** Generate full website content for all sections */
export async function generateWebsiteContent(keys: ApiKeys, business: {
  name: string;
  category: string;
  location: string;
  issues: string[];
  variant: string;
}): Promise<{
  hero: string;
  tagline: string;
  aboutTitle: string;
  aboutText: string;
  servicesTitle: string;
  services: { name: string; description: string }[];
  galleryTitle: string;
  contactTitle: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  visibleSections: string[];
}> {
  const prompt = `Generate complete website content for ${business.name}, a ${business.category} in ${business.location}.
Style variant: ${business.variant}
Detected issues: ${business.issues.join(', ') || 'None'}

Return a JSON object with EXACTLY these fields:
- hero: short compelling headline (5-8 words)
- tagline: one-line value proposition (10-15 words)
- aboutTitle: section heading like "About ${business.name}"
- aboutText: 2-3 sentences describing the business and what makes them great
- servicesTitle: section heading like "Our Services"
- services: array of { name, description } objects (3-4 services typical for this industry)
- galleryTitle: section heading like "Our Work"
- contactTitle: section heading like "Get In Touch"
- contactEmail: a realistic email address for this business
- contactPhone: a realistic phone number
- contactAddress: the location address
- primaryColor: hex color for primary brand color
- secondaryColor: hex color for secondary brand color
- accentColor: hex color for accent/highlight color
- visibleSections: array containing ALL of these: ["about", "services", "gallery", "contact"]

Return ONLY valid JSON, no markdown, no code fences.`;

  const response = await chatCompletion(keys, [
    { role: 'system', content: 'You are a professional web designer and copywriter. Return only valid JSON.' },
    { role: 'user', content: prompt },
  ], { temperature: 0.7, maxTokens: 1500 });

  try {
    const parsed = JSON.parse(response.content);
    return {
      hero: parsed.hero || `Premium ${business.category.toLowerCase()} services in ${business.location.split(',')[0]}`,
      tagline: parsed.tagline || 'Professional, modern, and built for your success.',
      aboutTitle: parsed.aboutTitle || `About ${business.name}`,
      aboutText: parsed.aboutText || `${business.name} provides quality ${business.category.toLowerCase()} services to the ${business.location.split(',')[0]} area.`,
      servicesTitle: parsed.servicesTitle || 'Our Services',
      services: Array.isArray(parsed.services) ? parsed.services : [{ name: business.category, description: `Professional ${business.category.toLowerCase()} services` }],
      galleryTitle: parsed.galleryTitle || 'Our Work',
      contactTitle: parsed.contactTitle || 'Get In Touch',
      contactEmail: parsed.contactEmail || 'info@' + business.name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com',
      contactPhone: parsed.contactPhone || '(555) 000-0000',
      contactAddress: parsed.contactAddress || business.location,
      primaryColor: parsed.primaryColor || '#2563eb',
      secondaryColor: parsed.secondaryColor || '#64748b',
      accentColor: parsed.accentColor || '#7c3aed',
      visibleSections: Array.isArray(parsed.visibleSections) ? parsed.visibleSections : ['about', 'services', 'gallery', 'contact'],
    };
  } catch {
    return {
      hero: `Premium ${business.category.toLowerCase()} services in ${business.location.split(',')[0]}`,
      tagline: 'Professional, modern, and built for your success.',
      aboutTitle: `About ${business.name}`,
      aboutText: `${business.name} provides quality ${business.category.toLowerCase()} services to the ${business.location.split(',')[0]} area.`,
      servicesTitle: 'Our Services',
      services: [{ name: business.category, description: `Professional ${business.category.toLowerCase()} services` }],
      galleryTitle: 'Our Work',
      contactTitle: 'Get In Touch',
      contactEmail: 'info@' + business.name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com',
      contactPhone: '(555) 000-0000',
      contactAddress: business.location,
      primaryColor: '#2563eb',
      secondaryColor: '#64748b',
      accentColor: '#7c3aed',
      visibleSections: ['about', 'services', 'gallery', 'contact'],
    };
  }
}
