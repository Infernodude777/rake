/**
 * Nano Banana 2 Image Generator
 * Uses Google Gemini API (Gemini 3.1 Flash Image / Imagen)
 *
 * API docs: https://ai.google.dev/gemini-api/docs/image-generation
 * Pricing:  https://ai.google.dev/pricing
 */
import { createRateLimiter } from '../utils/rateLimiter';

export const rateLimiter = createRateLimiter('Gemini Image', { rpm: 100, rpd: 1500 });

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export interface ImageGenOptions {
  width?: number;
  height?: number;
  aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
  style?: 'photorealistic' | 'modern' | 'minimalist' | 'luxury' | 'corporate';
}

export interface GeneratedImage {
  base64: string;
  mimeType: string;
  prompt: string;
}

/**
 * Generate a single image using Gemini's image generation capability.
 * Uses Gemini 2.0 Flash Experimental which supports native image output.
 */
export async function generateImage(
  apiKey: string,
  prompt: string,
  options: ImageGenOptions = {}
): Promise<GeneratedImage> {
  if (!apiKey) throw new Error('Gemini API key required for image generation.');

  await rateLimiter.acquire();

  const { style } = options;

  // Build enhanced prompt with style guidance
  let fullPrompt = prompt;
  if (style) {
    const styleGuides: Record<string, string> = {
      photorealistic: 'Ultra-realistic photograph, 8K, professional lighting, shot on DSLR, shallow depth of field, editorial quality',
      modern: 'Modern sleek design, clean lines, contemporary aesthetic, high-end, studio lighting, gradient accents',
      minimalist: 'Minimalist composition, clean white space, simple geometry, elegant, refined, premium feel',
      luxury: 'Luxury aesthetic, gold accents, marble textures, dramatic lighting, premium materials, exclusive atmosphere',
      corporate: 'Professional corporate style, clean office environment, natural light, trustworthy, approachable, polished',
    };
    fullPrompt = `${prompt}. ${styleGuides[style]}`;
  }

  const model = 'gemini-2.0-flash-exp-image-generation';

  try {
    const response = await fetch(
      `${GEMINI_BASE}/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Generate a high-quality, professional image: ${fullPrompt}`
            }]
          }],
          generationConfig: {
            temperature: 0.4,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 8192,
            responseModalities: ['Text', 'Image'],
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
          ],
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${err}`);
    }

    const data = await response.json();

    // Extract image from response parts
    for (const part of data.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return {
          base64: part.inlineData.data,
          mimeType: part.inlineData.mimeType || 'image/png',
          prompt: fullPrompt,
        };
      }
    }

    throw new Error('No image generated in response.');
  } catch (e: any) {
    // Fallback: try the Imagen model if Flash model fails
    if (e.message?.includes('not found') || e.message?.includes('404')) {
      return generateWithImagen(apiKey, fullPrompt, options);
    }
    throw e;
  }
}

/**
 * Fallback: Use Imagen 3 for image generation.
 */
async function generateWithImagen(
  apiKey: string,
  prompt: string,
  _options: ImageGenOptions
): Promise<GeneratedImage> {
  // Note: parent already acquired the rate limit, don't double-count
  const aspectRatio = _options.aspectRatio || '1:1';

  // Use Gemini generateContent with Imagen model via responseModalities
  const model = 'imagen-3.0-generate-001';

  const response = await fetch(
    `${GEMINI_BASE}/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Generate a high-quality image with ${aspectRatio} aspect ratio: ${prompt}`
          }]
        }],
        generationConfig: {
          temperature: 0.4,
          responseModalities: ['Image'],
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Imagen API error (${response.status}): ${err}`);
  }

  const data = await response.json();

  // Extract image from response parts (same format as generateContent)
  for (const part of data.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return {
        base64: part.inlineData.data,
        mimeType: part.inlineData.mimeType || 'image/png',
        prompt,
      };
    }
  }

  throw new Error('No image in Imagen response.');
}

/**
 * Generate multiple images in parallel for a website.
 * Returns URLs/data for hero image and gallery images.
 */
export async function generateWebsiteImages(
  apiKey: string,
  business: {
    name: string;
    category: string;
    location: string;
    variant: string;
    primaryColor?: string;
  }
): Promise<{
  heroImage: GeneratedImage | null;
  galleryImages: GeneratedImage[];
  logoPrompt: string;
}> {
  const variant = business.variant || 'Modern';
  const style = variant === 'Luxury' ? 'luxury' : variant === 'Modern' ? 'modern' : 'minimalist';

  // Build prompts tailored to the business
  const heroPrompt = `Professional hero banner for ${business.name}, a ${business.category} business in ${business.location}. Wide landscape format, showcasing the essence of their work. Beautiful composition, high-end commercial photography style. No text overlays.`;
  const logoPrompt = `Minimalist logo mark for ${business.name}, a ${business.category} business. Clean geometric design, ${style} style, suitable for a professional services website. No text, icon only, vector-style.`;

  const galleryPrompts = [
    `Interior of ${business.name} ${business.category} office in ${business.location}, professional and welcoming, natural lighting, ${style} aesthetic`,
    `${business.name} team providing ${business.category} services, professional interaction with client, genuine moment, candid style, warm tones`,
    `Detail shot of ${business.category} work by ${business.name}, craftsmanship, shallow depth of field, ${style}, premium quality`,
    `Exterior storefront of ${business.name} in ${business.location}, welcoming entrance, ${style} design, golden hour lighting`,
  ];

  // Generate hero + all gallery images in parallel
  const [heroResult, ...galleryResults] = await Promise.allSettled([
    apiKey ? generateImage(apiKey, heroPrompt, { style, aspectRatio: '16:9' }) : Promise.resolve(null),
    ...galleryPrompts.map((p) =>
      apiKey ? generateImage(apiKey, p, { style, aspectRatio: '4:3' }).catch(() => null) : Promise.resolve(null)
    ),
  ]);

  const heroImage = heroResult.status === 'fulfilled' ? heroResult.value : null;
  const galleryImages = galleryResults
    .filter((r): r is PromiseFulfilledResult<GeneratedImage | null> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((img): img is GeneratedImage => img !== null);

  return {
    heroImage,
    galleryImages: galleryImages.length > 0 ? galleryImages : [],
    logoPrompt,
  };
}

/**
 * Convert a base64 image to a displayable data URL.
 */
export function base64ToDataUrl(base64: string, mimeType: string = 'image/png'): string {
  return `data:${mimeType};base64,${base64}`;
}
