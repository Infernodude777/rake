import { BarChart3, Rocket, Phone } from 'lucide-react';
import type { Business } from '../types';

interface BusinessCardProps {
  business: Business;
  onAnalyze: (biz: Business) => void;
  onGenerate: (biz: Business) => void;
}

export default function BusinessCard({ business: biz, onAnalyze, onGenerate }: BusinessCardProps) {
  const scores = [
    ['Opp. Score', biz.opportunityScore],
    ['SEO', biz.seoScore],
    ['Mobile', biz.mobileScore],
    ['Urgency', biz.urgency],
    ['Close %', biz.closeProbability],
  ] as const;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="font-semibold text-xl tracking-tight">{biz.name}</div>
          <div className="text-xs px-3 py-px border border-zinc-700 text-zinc-400 rounded-full">
            {biz.category}
          </div>
          {biz.source && (
            <div className="text-[10px] px-2 py-px bg-zinc-800 text-zinc-500 rounded-full">
              via {biz.source}
            </div>
          )}
        </div>
        <div className="text-sm text-zinc-400 mt-px flex items-center gap-2 flex-wrap">
          <span>{biz.location}</span>
          <span className="text-zinc-600">•</span>
          <span>{biz.rating}★ ({biz.reviews} reviews)</span>
          {biz.phone && (
            <>
              <span className="text-zinc-600">•</span>
              <span className="flex items-center gap-1">
                <Phone size={11} className="text-zinc-500" />
                <a href={`tel:${biz.phone}`} className="hover:text-zinc-200 transition-colors">
                  {biz.phone}
                </a>
              </span>
            </>
          )}
        </div>

        <div className="mt-6 grid grid-cols-5 gap-px text-center text-xs">
          {scores.map(([label, value], idx) => (
            <div key={idx} className="bg-zinc-950 py-3 rounded-2xl">
              <div className="font-mono text-2xl font-medium tracking-tighter text-white">{value}</div>
              <div className="text-zinc-500 mt-px">{label}</div>
            </div>
          ))}
        </div>

        {biz.issues.length > 0 && (
          <div className="mt-4 flex gap-1.5 flex-wrap">
            {biz.issues.map((issue, idx) => (
              <span key={idx} className="text-[10px] px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded-full">
                {issue}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col justify-center gap-2 w-56 flex-shrink-0">
        <button
          onClick={() => onAnalyze(biz)}
          className="flex-1 px-5 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-2xl text-sm flex items-center justify-center gap-2 transition-colors"
        >
          <BarChart3 size={15} /> View Analysis
        </button>
        <button
          onClick={() => onGenerate(biz)}
          className="flex-1 px-5 py-3 bg-white text-black rounded-2xl text-sm flex items-center justify-center gap-2 font-medium hover:bg-zinc-200 transition-colors"
        >
          Generate Website <Rocket size={15} />
        </button>
      </div>
    </div>
  );
}
