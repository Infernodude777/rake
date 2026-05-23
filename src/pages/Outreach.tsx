import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { generateOutreachEmail, rateLimiter as llmLimiter } from '../services/llm';
import { RateLimitError } from '../utils/rateLimiter';

export default function Outreach() {
  const { apiKeys, businesses, addNotification, settings } = useData();
  const [email, setEmail] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Sync LLM rate limiter config from user settings
  useEffect(() => {
    if (settings.rateLimits?.llm) {
      llmLimiter.updateConfig(settings.rateLimits.llm);
    }
  }, [settings.rateLimits]);

  const handleGenerate = async () => {
    if (businesses.length === 0) {
      addNotification('No businesses to reach out to. Discover some businesses first.');
      return;
    }

    setIsGenerating(true);
    try {
      const biz = businesses[0];
      const generated = await generateOutreachEmail(apiKeys, {
        name: biz.name,
        category: biz.category,
        location: biz.location,
        issues: biz.issues,
        score: biz.opportunityScore,
      });
      setEmail(generated);
      addNotification(`Email generated for ${biz.name}`);
    } catch (e: any) {
      if (e instanceof RateLimitError) {
        addNotification(`⏳ LLM rate limited — email generation paused (resets in ${Math.ceil(e.retryAfterMs / 60000)} min)`);
      } else {
        addNotification(`Email generation failed: ${e.message}`);
      }
      // Fallback demo email
      setEmail(`Hi team at ${businesses[0].name},

I noticed your current site is missing key features that could help you grow. We've built a new experience that converts 2.8× better for businesses in your area. Would you be open to a 7-minute audit?

Best,
Maya`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-8 max-w-xl mx-auto">
      <div className="text-center">
        <div className="text-4xl tracking-tight font-medium">Personalized outreach.</div>
        <div className="text-zinc-400 mt-3 text-sm">
          Every email is generated from scraped data, opportunity analysis, and competitor insights.
        </div>
      </div>

      {email && (
        <div className="mt-10 bg-zinc-900 p-9 rounded-3xl text-sm border border-zinc-800 leading-relaxed whitespace-pre-line">
          {email}
        </div>
      )}

      {!email && (
        <div className="mt-10 bg-zinc-900 p-9 rounded-3xl text-sm border border-zinc-800 leading-relaxed text-zinc-500 text-center">
          {businesses.length > 0
            ? 'Click the button below to generate a personalized email.'
            : 'Discover businesses first to generate outreach emails.'}
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="mt-4 w-full py-4 rounded-2xl bg-white text-black font-medium text-sm hover:bg-zinc-200 transition-colors disabled:opacity-50"
      >
        {isGenerating ? 'Generating...' : businesses.length > 0 ? `Generate ${businesses.length} Personalized Emails` : 'Generate Personalized Email'}
      </button>
    </div>
  );
}
