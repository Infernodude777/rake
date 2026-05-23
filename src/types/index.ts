// === Business / Lead Types ===

export interface Business {
  id: number;
  name: string;
  category: string;
  location: string;
  rating: number;
  reviews: number;
  website: string;
  opportunityScore: number;
  seoScore: number;
  mobileScore: number;
  urgency: number;
  closeProbability: number;
  issues: string[];
  tech: string[];
  source?: string;
  yelpUrl?: string;
  googlePlaceId?: string;
  createdAt: number;
}

export interface Lead {
  id: number;
  business: string;
  businessId: number;
  stage: LeadStage;
  score: number;
  value: string;
  lastActivity: string;
  createdAt: number;
}

export type LeadStage = 'discovered' | 'qualified' | 'contacted' | 'replied' | 'proposal' | 'won';

export const LEAD_STAGES: LeadStage[] = ['discovered', 'qualified', 'contacted', 'replied', 'proposal', 'won'];

// === Website Types ===

export interface Website {
  id: number;
  name: string;
  business: string;
  status: WebsiteStatus;
  visits: number;
  conversion: number;
  variant: string;
  heroHeadline?: string;
  opportunityScore?: number;
  issues?: string[];
  createdAt: number;
}

export type WebsiteStatus = 'draft' | 'deployed' | 'live';

export interface GeneratedSite {
  id: number;
  name: string;
  business: string;
  variant: string;
  hero: string;
  issues: string[];
  score: number;
}

// === Notification Types ===

export interface Notification {
  id: number;
  message: string;
  time: string;
  read: boolean;
  createdAt: number;
}

// === API Key Types ===

export interface ApiKeys {
  llmBaseUrl: string;
  llmModelId: string;
  llmApiKey: string;
  firecrawlApiKey: string;
  googleMapsApiKey: string;
  yelpApiKey: string;
}

export const DEFAULT_API_KEYS: ApiKeys = {
  llmBaseUrl: 'https://api.openai.com/v1',
  llmModelId: 'gpt-4o',
  llmApiKey: '',
  firecrawlApiKey: '',
  googleMapsApiKey: '',
  yelpApiKey: '',
};

// === Dashboard Types ===

export interface DashboardStat {
  label: string;
  value: string;
  change: string;
}

export interface DailyData {
  name: string;
  leads: number;
  websites: number;
  outreach: number;
}

export interface PieData {
  name: string;
  value: number;
  fill: string;
}

// === Nav Types ===

export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}

// === Rate Limits ===

export interface RateLimitConfig {
  rpm: number;
  rpd: number;
}

export type RateLimitPreset = Record<string, RateLimitConfig>;

export const DEFAULT_RATE_LIMITS: RateLimitPreset = {
  yelp: { rpm: 5, rpd: 290 },
  google: { rpm: 10, rpd: 100000 },
  firecrawl: { rpm: 3, rpd: 490 },
  llm: { rpm: 30, rpd: 5000 },
};

// === Settings ===

export interface AppSettings {
  workspaceName: string;
  userName: string;
  rateLimits: RateLimitPreset;
}
