/**
 * LLM Service — designarena.ai-quality system prompts for website generation.
 * Uses OpenAI-compatible chat completions API with dramatically enhanced prompting.
 */
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
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
        max_tokens: options?.maxTokens ?? 4096,
      }),
      signal: controller.signal,
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
  } finally {
    clearTimeout(timeout);
  }
}

// ═══════════════════════════════════════════════════════════════
//  DESIGNARENA-QUALITY SYSTEM PROMPT
//  Professional-grade AI design generation with best-practice
//  enforcement, detail injection, and actionable specifications.
// ═══════════════════════════════════════════════════════════════

const DESIGN_SYSTEM_PROMPT = `You are DesignArena Elite — a world-class principal web designer and creative director with 20+ years of experience leading design at agencies like Pentagram, IDEO, and Apple's Human Interface team. You have won multiple Awwwards Site of the Year, Webbys, and D&AD Black Pencils. Your work is featured in Communication Arts, Smashing Magazine, and the CSS Design Awards Hall of Fame.

You are also a master full-stack developer who writes production-grade HTML, CSS, and JavaScript. Your code is semantic, accessible, performant, and beautiful.

## YOUR DESIGN PHILOSOPHY
You practice elite-level design craftsmanship. Every output must reflect:

### 1. TYPOGRAPHY MASTERY
- Use a refined type scale: headings at 4xl/5xl/6xl with tight letter-spacing (-0.02em to -0.04em), body at base/lg with 1.6-1.8 line-height
- Pair typefaces intentionally: a distinctive display font for hero/headings, a highly-readable workhorse for body
- Implement proper typographic hierarchy with clear visual separation between H1 → H2 → H3 → body → caption
- Use variable font weights strategically: 800 for impact statements, 600 for section heads, 400 for body, 300 for captions
- NEVER use default browser font stacks — always specify professional, modern typefaces

### 2. COLOR THEORY EXCELLENCE
- Derive a cohesive 5-color palette: Primary (dominant brand), Secondary (supporting), Accent (CTAs/highlights), Neutral-900 (text), Neutral-50 (background)
- Use HSL color space for perceptually uniform gradients and shadows
- Apply the 60-30-10 rule: 60% dominant neutral, 30% secondary, 10% accent
- Ensure WCAG AAA contrast ratios (7:1 minimum for body text)
- Use subtle color psychology: warm tones for hospitality, cool blues for finance/tech, earthy for organic/wellness

### 3. SPATIAL DESIGN & LAYOUT
- Implement an 8px soft grid system — all spacing values are multiples of 8 (8, 16, 24, 32, 48, 64, 80, 96, 128)
- Use asymmetric balance: offset elements intentionally, vary column widths, create visual tension
- Apply the golden ratio (1.618) to section proportions and content-to-whitespace ratios
- Maximum content width: 1200px with generous side padding (min 40px)
- Section vertical padding: minimum 80px, hero sections 120-160px
- Use negative space as an active design element, not just empty area

### 4. MODERN UI PATTERNS
- Glassmorphism where appropriate: backdrop-filter: blur(16px), semi-transparent backgrounds, subtle borders
- Micro-interactions: hover scale(1.02), active scale(0.98), smooth 300ms ease-out transitions
- Staggered reveal animations using opacity + translateY transforms
- Cards with subtle hover lift: translateY(-4px) + box-shadow expansion
- Smooth scroll behavior, scroll-snap where beneficial
- Gradient meshes and noise textures for depth (SVG noise filter at 3-5% opacity)

### 5. RESPONSIVE DESIGN
- Mobile-first breakpoints: sm(640), md(768), lg(1024), xl(1280), 2xl(1536)
- Fluid typography using clamp(): headings scale from 2rem→4rem, body from 1rem→1.125rem
- Grid layouts that collapse gracefully: auto-fit with minmax
- Touch targets minimum 44x44px on mobile
- No horizontal scroll, no fixed widths, no absolute positioning that breaks flow

### 6. ACCESSIBILITY (WCAG 2.2 AA+)
- Semantic HTML5 landmarks: <header>, <nav>, <main>, <section>, <article>, <footer>
- Proper heading hierarchy: single <h1>, sequential <h2>-<h6> without skipping levels
- All images have descriptive alt text
- Focus-visible outlines with good contrast (2px offset ring)
- ARIA labels on interactive elements without visible text
- Skip-to-content link as first focusable element
- Reduced motion media query respected

### 7. PERFORMANCE & SEO
- Critical CSS inlined, non-critical deferred
- Font-display: swap with proper fallback stack
- Semantic HTML that search engines can parse meaningfully
- Structured data (JSON-LD) for LocalBusiness schema
- Open Graph and Twitter Card meta tags
- Lazy loading for below-fold images

### 8. CONVERSION PSYCHOLOGY
- Clear visual hierarchy guiding the eye to CTAs
- Social proof elements: testimonial cards, review stars, trust badges
- Scarcity and urgency cues where authentic
- F-pattern and Z-pattern reading layouts for scanability
- CTA buttons: high contrast, action-oriented microcopy, prominent placement
- Trust signals: professional certifications, awards, client logos, case study snippets

## YOUR OUTPUT STANDARD
Every design you produce must feel like a \$50,000 agency deliverable. It must be:
- Visually stunning on first impression
- Functionally complete (real HTML/CSS, not placeholders)
- Production-ready (no lorem ipsum, no FPO images, no TODO comments)
- Accessible to all users
- Responsive across all device sizes
- Optimized for conversion`;

// ═══════════════════════════════════════════════════════════════

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
  const sysPrompt = `You are a senior business development analyst at a top-tier web agency. You evaluate local businesses to determine their potential value as web design clients.

Analyze factors including: absence of website, outdated design signals, poor mobile presence, weak SEO, negative reviews mentioning digital experience, competitor website quality in the area, and revenue potential based on industry.

Provide precise 0-100 scores with clear justification. Be honest — don't inflate scores for bad opportunities. Use real industry benchmarks.`;

  const prompt = `Analyze this local business as a potential web design client:

BUSINESS PROFILE
━━━━━━━━━━━━━━━━━
Name: ${business.name}
Category: ${business.category}
Location: ${business.location}
Google Rating: ${business.rating}★ (${business.reviews} reviews)
Detected Digital Issues: ${business.issues.join(', ') || 'None identified'}
Current Tech Stack: ${business.tech.join(', ') || 'Unknown — likely no modern web presence'}

SCORING CRITERIA
━━━━━━━━━━━━━━━━━
- opportunityScore (0-100): Overall attractiveness as a client — consider revenue potential, industry growth, local competition
- seoScore (0-100): Current SEO quality — consider if they even have a website, Google My Business optimization, local search presence
- mobileScore (0-100): Current mobile readiness — most small businesses score 10-30 unless they have a modern responsive site
- urgency (0-100): How urgently they need a new site — high urgency if no site, bad reviews, losing to competitors
- closeProbability (0-100): Likelihood we could close this deal — consider budget capacity (industry avg website spend), decision-maker accessibility
- summary: Detailed 2-3 sentence analysis with specific, actionable insights about this opportunity

Return ONLY valid JSON with these exact keys. No markdown, no code fences, no commentary.`;

  const response = await chatCompletion(keys, [
    { role: 'system', content: sysPrompt },
    { role: 'user', content: prompt },
  ], { temperature: 0.3, maxTokens: 1024 });

  try {
    // Strip any markdown fences
    const cleaned = response.content.replace(/```(?:json)?\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
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
      opportunityScore: 50, seoScore: 50, mobileScore: 50,
      urgency: 50, closeProbability: 50,
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
  const sysPrompt = `You are a senior sales development representative at an award-winning web design agency. You've closed over $2M in web design contracts. Your emails get 40%+ response rates because they're:
- Genuinely personalized (you actually researched their business)
- Value-first (you give before you ask)
- Conversationally professional (like a thoughtful colleague, not a salesperson)
- Specific about problems you noticed (proof you did your homework)
- Brief and scannable (busy owners read on phones)`;

  const prompt = `Write a cold outreach email to ${business.name}, a ${business.category} in ${business.location}.

RESEARCH NOTES
━━━━━━━━━━━━━━━━━
Digital Issues Identified: ${business.issues.join(', ') || 'Outdated/no web presence'}
Our Opportunity Score: ${business.score}/100 (higher = better prospect)

EMAIL REQUIREMENTS
━━━━━━━━━━━━━━━━━
- Reference 1-2 specific issues you noticed about their digital presence (be specific, show you actually looked)
- Offer genuine value upfront — mention a quick audit or competitive insight they'd find useful
- Keep it to 4 short paragraphs maximum
- Subject line should feel personal, not salesy (include it as the first line prefixed with "Subject: ")
- Sound like a peer, not a vendor
- No "checking in," "touching base," or "following up" language
- No "we are a leading provider" boilerplate
- Sign as Maya Chen, Creative Director

Write ONLY the email text. No explanations, no meta-commentary.`;

  const response = await chatCompletion(keys, [
    { role: 'system', content: sysPrompt },
    { role: 'user', content: prompt },
  ], { temperature: 0.8, maxTokens: 600 });

  return response.content;
}

// ═══════════════════════════════════════════════════════════════
//  WEBSITE CONTENT GENERATION (designarena-quality)
// ═══════════════════════════════════════════════════════════════

/** Generate comprehensive website content with professional copywriting */
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
  metaDescription: string;
  metaKeywords: string;
}> {
  const variantGuidance = business.variant === 'Luxury'
    ? 'Write in an elevated, sophisticated voice. Use refined language with gravitas. Target high-end clientele. Emphasize exclusivity, craftsmanship, and premium experience.'
    : business.variant === 'Minimal'
    ? 'Write in a clean, direct, confident voice. Less is more. Every word must earn its place. Focus on clarity, efficiency, and essential value.'
    : 'Write in a bold, contemporary, visionary voice. Emphasize innovation, transformation, and forward-thinking. Energy and momentum.' ;

  const prompt = `You are the lead copywriter at a top-tier branding agency. Write complete, publication-ready website copy for:

BUSINESS: ${business.name}
CATEGORY: ${business.category}
LOCATION: ${business.location}
TONE: ${variantGuidance}
DETECTED ISSUES (address these strengths): ${business.issues.join(', ') || 'General web presence'}

REQUIREMENTS:
━━━━━━━━━━━━━━━━━
- Every piece of copy must feel crafted by a professional copywriter, not generated by AI
- No clichés: no "cutting-edge," "best-in-class," "world-class," "unparalleled," "synergy"
- Use the business name naturally — don't force it into every sentence
- Vary sentence length and structure for rhythm — mix short punchy statements with flowing descriptive sentences
- Write for humans scanning at high speed: lead with the most important words

RETURN EXACTLY THIS JSON STRUCTURE:
{
  "hero": "Compelling 5-8 word headline that makes the reader FEEL something",
  "tagline": "One compelling sentence (10-15 words) that articulates the unique value. Specific, not generic.",
  "aboutTitle": "Section heading for the About section. Creative, not just 'About Us'.",
  "aboutText": "2-3 rich sentences that tell a STORY about this business. Include a concrete detail or specific claim that differentiates them.",
  "servicesTitle": "Creative section heading for Services. Not just 'Our Services'.",
  "services": [
    {"name": "Specific service name", "description": "One compelling sentence per service. Focus on OUTCOME, not process."}
  ],
  "galleryTitle": "Creative section heading for the gallery/portfolio area",
  "contactTitle": "Inviting section heading for contact. Make them WANT to reach out.",
  "contactEmail": "Realistic professional email for this business",
  "contactPhone": "Formatted phone number like (555) 123-4567",
  "contactAddress": "The business location as a readable address",
  "primaryColor": "Hex color for primary brand — choose based on industry psychology",
  "secondaryColor": "Hex color for secondary brand — complement the primary",
  "accentColor": "Hex color for CTAs and highlights — should pop against primary",
  "visibleSections": ["about", "services", "gallery", "contact"],
  "metaDescription": "155-char SEO meta description with primary keyword naturally placed",
  "metaKeywords": "5-7 relevant SEO keywords, comma-separated"
}

IMPORTANT: Return ONLY valid JSON. No markdown fences, no explanation text, no code block backticks. The response must parse as JSON directly.`;

  const response = await chatCompletion(keys, [
    { role: 'system', content: DESIGN_SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ], { temperature: 0.7, maxTokens: 2500 });

  try {
    const cleaned = response.content.replace(/```(?:json)?\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
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
      metaDescription: parsed.metaDescription || `Professional ${business.category} services by ${business.name} in ${business.location}. Quality, reliability, and exceptional results.`,
      metaKeywords: parsed.metaKeywords || `${business.category}, ${business.location}, ${business.name}, professional services`,
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
      primaryColor: '#2563eb', secondaryColor: '#64748b', accentColor: '#7c3aed',
      visibleSections: ['about', 'services', 'gallery', 'contact'],
      metaDescription: `Professional ${business.category} services by ${business.name} in ${business.location}.`,
      metaKeywords: `${business.category}, ${business.location}, ${business.name}`,
    };
  }
}

// ═══════════════════════════════════════════════════════════════
//  FULL WEBSITE HTML GENERATION (standalone deployable file)
// ═══════════════════════════════════════════════════════════════

export interface WebsiteHTMLOptions {
  name: string;
  category: string;
  location: string;
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
  heroImageUrl?: string;
  galleryImageUrls?: string[];
  metaDescription: string;
  metaKeywords: string;
  variant: string;
}

/**
 * Generate a complete, standalone, production-ready HTML file.
 * This is the designarena-quality full website output.
 */
export async function generateFullWebsiteHTML(
  keys: ApiKeys,
  options: WebsiteHTMLOptions
): Promise<string> {
  const variantGuide = options.variant === 'Luxury'
    ? 'Dark navy/gold luxury palette, serif headings, elegant transitions, marble-like textures, premium feel'
    : options.variant === 'Minimal'
    ? 'Clean white/light gray palette, generous whitespace, monochrome with single accent, Swiss design influence'
    : 'Dark mode, bold gradients, glass morphism effects, modern sans-serif, high contrast, futuristic feel';

  const prompt = `Generate a COMPLETE, production-ready, standalone HTML file for this business website.

BUSINESS DETAILS:
━━━━━━━━━━━━━━━━━
Name: ${options.name}
Category: ${options.category}
Location: ${options.location}
Design Variant: ${variantGuide}
Primary Color: ${options.primaryColor}
Secondary Color: ${options.secondaryColor}
Accent Color: ${options.accentColor}

WEBSITE COPY:
━━━━━━━━━━━━━━━━━
Hero Headline: "${options.hero}"
Tagline: "${options.tagline}"
${options.aboutTitle}: "${options.aboutText}"
${options.servicesTitle}: ${JSON.stringify(options.services)}
${options.contactTitle}:
  Email: ${options.contactEmail}
  Phone: ${options.contactPhone}
  Address: ${options.contactAddress}

METADATA:
━━━━━━━━━━━━━━━━━
Meta Description: ${options.metaDescription}
Meta Keywords: ${options.metaKeywords}

SECTIONS TO INCLUDE:
━━━━━━━━━━━━━━━━━
${options.visibleSections.join(', ')}

CRITICAL REQUIREMENTS:
━━━━━━━━━━━━━━━━━
1. Output a SINGLE complete .html file — everything inline: CSS in <style>, JS in <script>
2. Use vanilla HTML5, CSS3, and minimal vanilla JavaScript — NO external dependencies, NO CDN links, NO frameworks
3. All CSS must be comprehensive — not just utility classes. Write real, well-structured CSS.
4. Include a professional sticky navigation bar with smooth-scroll anchor links to each section
5. Implement FULL responsive design with mobile hamburger menu
6. Add subtle scroll-reveal animations using Intersection Observer
7. Include a functional contact form (no backend needed — show success toast on submit)
8. ${options.galleryImageUrls && options.galleryImageUrls.length > 0 ? `Use these gallery image URLs where available: ${options.galleryImageUrls.slice(0, 4).join(', ')}` : 'Create CSS-only decorative gallery placeholders with abstract geometric patterns'}
9. ${options.heroImageUrl ? `Use this hero image: ${options.heroImageUrl}` : 'Create a CSS gradient/animation hero background'}
10. Include a footer with copyright, business name, and back-to-top button
11. Add JSON-LD structured data for LocalBusiness schema
12. All images must have proper alt text for accessibility
13. The entire file must parse as valid HTML5
14. Include proper viewport meta tag and charset
15. Add Open Graph and Twitter Card meta tags

DESIGN QUALITY MANDATES:
━━━━━━━━━━━━━━━━━
- This must look like a \$10,000+ professionally designed website
- Use smooth transitions (300ms ease-out) on interactive elements
- Apply subtle hover effects on cards (translateY(-4px) + shadow expansion)
- Use CSS custom properties (--primary, --secondary, --accent, --text, --bg) throughout
- Headings must use proper typographic scale with tight letter-spacing
- Section spacing: minimum 80px vertical padding
- Cards: border-radius 12-16px, subtle box-shadow, smooth hover lift
- CTA buttons: high contrast, generous padding (14px 36px min), font-weight 600+
- Mobile: hamburger menu, stacked layouts, increased touch targets (44px min)

Return ONLY the complete HTML file content. Start with <!DOCTYPE html> and end with </html>. No markdown fences, no explanations, no meta-commentary. Just the raw HTML.`;

  const response = await chatCompletion(keys, [
    { role: 'system', content: DESIGN_SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ], { temperature: 0.5, maxTokens: 8192 });

  // Strip any markdown fences if present
  let html = response.content;
  html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '');
  if (!html.startsWith('<!DOCTYPE') && !html.startsWith('<html')) {
    // Model might have included commentary — try to extract HTML
    const htmlMatch = html.match(/<!DOCTYPE html>[\s\S]*<\/html>/i);
    if (htmlMatch) html = htmlMatch[0];
  }
  return html.trim();
}
