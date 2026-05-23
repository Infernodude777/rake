import { useState, useCallback } from 'react';
import { useData } from '../context/DataContext';
import type { ApiKeys } from '../types';
import { DEFAULT_RATE_LIMITS } from '../types';
import { Eye, EyeOff, Check, Gauge, ExternalLink, Loader2 } from 'lucide-react';
import { testYelpKey, testGoogleKey, testFirecrawlKey, testLlmKey } from '../utils/testApiKeys';
import type { TestResult } from '../utils/testApiKeys';

interface KeyField {
  id: keyof ApiKeys;
  label: string;
  placeholder: string;
  url: string;
  urlLabel: string;
  steps: string[];
}

const KEY_FIELDS: KeyField[] = [
  {
    id: 'llmApiKey',
    label: 'LLM API Key',
    placeholder: 'sk-...',
    url: 'https://platform.openai.com/api-keys',
    urlLabel: 'platform.openai.com/api-keys',
    steps: [
      'Go to platform.openai.com and sign in or create an account',
      'Add billing details under Settings > Billing (minimum $5)',
      'Navigate to API Keys and click "Create new secret key"',
      'Copy the key (starts with sk-...) and paste it below',
      'Tip: You can also use Groq for free — set Base URL to https://api.groq.com/openai/v1 and Model ID to llama-3.3-70b-versatile',
    ],
  },
  {
    id: 'llmBaseUrl',
    label: 'LLM Base URL',
    placeholder: 'https://api.openai.com/v1',
    url: 'https://platform.openai.com',
    urlLabel: 'platform.openai.com',
    steps: [
      'Default: https://api.openai.com/v1 — works with OpenAI',
      'Groq (free): https://api.groq.com/openai/v1',
      'Together AI: https://api.together.xyz/v1',
      'Any OpenAI-compatible API endpoint works here',
    ],
  },
  {
    id: 'llmModelId',
    label: 'LLM Model ID',
    placeholder: 'gpt-4o',
    url: 'https://platform.openai.com/docs/models',
    urlLabel: 'platform.openai.com/models',
    steps: [
      'OpenAI: gpt-4o (default), gpt-4o-mini (cheaper), o3-mini',
      'Groq: llama-3.3-70b-versatile, llama-3.1-8b-instant',
      'Together AI: mistralai/Mixtral-8x22B-Instruct-v0.1',
      'Use any model ID supported by your LLM provider',
    ],
  },
  {
    id: 'yelpApiKey',
    label: 'Yelp Fusion API Key',
    placeholder: 'yelp-api-key',
    url: 'https://www.yelp.com/developers',
    urlLabel: 'yelp.com/developers',
    steps: [
      'Go to yelp.com/developers and sign in (free Yelp account)',
      'Click "Create App" and fill in the required fields',
      'Accept the terms of service',
      'Copy the "API Key" from the app dashboard',
      'Paste it below — free tier gives 5,000 calls/day',
    ],
  },
  {
    id: 'googleMapsApiKey',
    label: 'Google Maps API Key',
    placeholder: 'AIza...',
    url: 'https://console.cloud.google.com',
    urlLabel: 'console.cloud.google.com',
    steps: [
      'Go to console.cloud.google.com and create a project',
      'Go to "APIs & Services" → "Library"',
      'Search for "Places API" and click "Enable"',
      'Go to "Credentials" → "Create Credentials" → "API Key"',
      'Optional: Restrict the key to Places API only (recommended)',
      'Paste it below — free tier gives $200/mo credit (~66k searches)',
    ],
  },
  {
    id: 'firecrawlApiKey',
    label: 'Firecrawl API Key',
    placeholder: 'fc-...',
    url: 'https://www.firecrawl.dev',
    urlLabel: 'firecrawl.dev',
    steps: [
      'Go to firecrawl.dev and sign up for an account',
      'Choose the Starter plan ($19/mo) or free trial',
      'Go to your dashboard → API Keys section',
      'Copy your API key (starts with fc-...)',
      'Paste it below — used to crawl business websites for SEO/tech analysis',
    ],
  },
];

export default function Settings() {
  const { apiKeys, setApiKeys, settings, setSettings, clearData } = useData();
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);
  const [expandedHelp, setExpandedHelp] = useState<Set<string>>(new Set());
  const [testingKeys, setTestingKeys] = useState<Set<string>>(new Set());
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  const toggleHelp = (id: string) => {
    setExpandedHelp((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleVisible = (id: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTestConnection = useCallback(async (fieldId: string) => {
    setTestingKeys((prev) => new Set(prev).add(fieldId));
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });

    let result: TestResult;
    try {
      switch (fieldId) {
        case 'yelpApiKey':
          result = await testYelpKey(apiKeys.yelpApiKey);
          break;
        case 'googleMapsApiKey':
          result = await testGoogleKey(apiKeys.googleMapsApiKey);
          break;
        case 'firecrawlApiKey':
          result = await testFirecrawlKey(apiKeys.firecrawlApiKey);
          break;
        case 'llmApiKey':
          result = await testLlmKey({
            apiKey: apiKeys.llmApiKey,
            baseUrl: apiKeys.llmBaseUrl,
            modelId: apiKeys.llmModelId,
          });
          break;
        default:
          result = { success: false, message: 'Unknown key type.' };
      }
    } catch {
      result = { success: false, message: 'Test failed unexpectedly.' };
    }

    setTestResults((prev) => ({ ...prev, [fieldId]: result }));
    setTestingKeys((prev) => {
      const next = new Set(prev);
      next.delete(fieldId);
      return next;
    });

    // Auto-clear result after 8 seconds
    setTimeout(() => {
      setTestResults((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }, 8000);
  }, [apiKeys]);

  const configuredCount = Object.values(apiKeys).filter((v) => v !== '').length;
  const totalCount = Object.keys(apiKeys).length;

  const handleSave = () => {
    // Keys are auto-persisted via the DataContext effect
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="text-4xl tracking-tight mb-8 font-semibold">Settings</div>

      {/* Workspace */}
      <div className="mb-8">
        <div className="text-sm font-medium mb-3 text-zinc-300">Workspace</div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4">
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Workspace Name</label>
            <input
              value={settings.workspaceName}
              onChange={(e) => setSettings({ workspaceName: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-600 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Display Name</label>
            <input
              value={settings.userName}
              onChange={(e) => setSettings({ userName: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-600 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* API Keys */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-zinc-300">BYO API Keys</div>
          <div className="text-xs text-zinc-500">
            {configuredCount}/{totalCount} configured
          </div>
        </div>
        <div className="text-xs text-zinc-500 mb-4 px-1">
          Bring your own API keys. These are stored in your browser and never sent to our servers.
        </div>

        <div className="space-y-2">
          {KEY_FIELDS.map((field) => {
            const isApiKey = field.id.endsWith('ApiKey');
            return (
              <div key={field.id}>
                <div className="flex items-center gap-3 bg-zinc-900 px-5 py-4 border border-zinc-800 rounded-2xl">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-zinc-400">{field.label}</span>
                      <button
                        onClick={() => toggleHelp(field.id)}
                        className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors underline underline-offset-2 decoration-dotted"
                      >
                        {expandedHelp.has(field.id) ? 'hide help' : 'how to get?'}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={isApiKey && !visibleKeys.has(field.id) ? 'password' : 'text'}
                        value={apiKeys[field.id]}
                        onChange={(e) => setApiKeys({ ...apiKeys, [field.id]: e.target.value })}
                        placeholder={field.placeholder}
                        className="w-full bg-transparent text-sm placeholder:text-zinc-600 focus:outline-none"
                      />
                    </div>
                  </div>
                  {isApiKey && (
                    <button
                      onClick={() => toggleVisible(field.id)}
                      className="text-zinc-500 hover:text-white transition-colors flex-shrink-0"
                      title="Toggle visibility"
                    >
                      {visibleKeys.has(field.id) ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  )}
                  <div className="flex items-center gap-2">
                {isApiKey && apiKeys[field.id] && (
                  testResults[field.id] ? (
                    <span className={`text-[10px] font-medium ${testResults[field.id].success ? 'text-emerald-400' : 'text-red-400'}`}>
                      {testResults[field.id].success ? 'Connected' : 'Failed'}
                    </span>
                  ) : testingKeys.has(field.id) ? (
                    <Loader2 size={13} className="animate-spin text-zinc-400" />
                  ) : (
                    <button
                      onClick={() => handleTestConnection(field.id)}
                      className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors"
                    >
                      Test
                    </button>
                  )
                )}
                <div className={`flex-shrink-0 w-2 h-2 rounded-full ${apiKeys[field.id] ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
              </div>
                </div>

                {expandedHelp.has(field.id) && (
                  <div className="mt-1 bg-zinc-900/60 border border-zinc-800/60 rounded-2xl px-5 py-4 text-xs text-zinc-400 space-y-2">
                    <a
                      href={field.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <ExternalLink size={12} />
                      {field.urlLabel}
                    </a>
                    <ol className="space-y-1.5 list-decimal list-inside text-zinc-500">
                      {field.steps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={handleSave}
          className={`mt-4 px-8 py-3 rounded-2xl text-sm font-medium transition-all ${
            saved
              ? 'bg-emerald-500 text-white'
              : 'bg-white text-black hover:bg-zinc-200'
          }`}
        >
          {saved ? (
            <span className="flex items-center gap-2"><Check size={16} /> Saved</span>
          ) : (
            'Save API Keys'
          )}
        </button>
      </div>

      {/* Rate Limits */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm font-medium mb-3 text-zinc-300">
          <Gauge size={15} /> Rate Limits
        </div>
        <div className="text-xs text-zinc-500 mb-4 px-1">
          Max requests per minute (RPM) and requests per day (RPD) for each API.
          The rate limiter will automatically queue requests to stay within these limits.
        </div>

        <div className="space-y-2">
          {Object.entries(settings.rateLimits).map(([service, config]) => (
            <div key={service} className="flex items-center gap-4 bg-zinc-900 px-5 py-4 border border-zinc-800 rounded-2xl">
              <div className="w-20 flex-shrink-0">
                <div className="text-xs text-zinc-400 capitalize">{service}</div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-zinc-500">RPM</label>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={config.rpm}
                  onChange={(e) => {
                    const rpm = Math.max(1, parseInt(e.target.value) || 1);
                    setSettings({
                      rateLimits: {
                        ...settings.rateLimits,
                        [service]: { ...config, rpm },
                      },
                    });
                  }}
                  className="w-16 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-center focus:outline-none focus:border-zinc-600 transition-colors"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-zinc-500">RPD</label>
                <input
                  type="number"
                  min={1}
                  max={999999}
                  value={config.rpd}
                  onChange={(e) => {
                    const rpd = Math.max(1, parseInt(e.target.value) || 1);
                    setSettings({
                      rateLimits: {
                        ...settings.rateLimits,
                        [service]: { ...config, rpd },
                      },
                    });
                  }}
                  className="w-20 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-center focus:outline-none focus:border-zinc-600 transition-colors"
                />
              </div>
              <button
                onClick={() => {
                  const defaults = DEFAULT_RATE_LIMITS[service as keyof typeof DEFAULT_RATE_LIMITS];
                  if (defaults) {
                    setSettings({
                      rateLimits: {
                        ...settings.rateLimits,
                        [service]: { ...defaults },
                      },
                    });
                  }
                }}
                className="ml-auto text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Reset
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Data */}
      <div>
        <div className="text-sm font-medium mb-3 text-zinc-300">Data</div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
          <div className="text-xs text-zinc-400">
            All data is stored in your browser's localStorage. Clearing your browser data will remove it.
          </div>
          <button
            onClick={() => {
              if (window.confirm('Clear all local data? This cannot be undone.')) {
                clearData();
              }
            }}
            className="mt-4 px-6 py-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl hover:bg-red-500/20 transition-colors"
          >
            Clear All Data
          </button>
        </div>
      </div>
    </div>
  );
}
