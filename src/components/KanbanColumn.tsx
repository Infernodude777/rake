import type { Lead, LeadStage } from '../types';
import { useData } from '../context/DataContext';

interface KanbanColumnProps {
  stage: LeadStage;
  leads: Lead[];
}

export default function KanbanColumn({ stage, leads }: KanbanColumnProps) {
  const { moveLead } = useData();

  return (
    <div className="min-w-[230px] bg-zinc-900 border border-zinc-800 rounded-3xl p-4 flex-shrink-0">
      <div className="font-medium text-xs uppercase tracking-[1px] px-1 pb-4 text-zinc-400">
        {stage} • {leads.length}
      </div>
      {leads.map((lead) => (
        <div
          key={lead.id}
          onClick={() => moveLead(lead.id)}
          className="bg-zinc-950 border border-zinc-800 p-4 mb-3 rounded-2xl cursor-pointer active:scale-[0.985] transition-transform hover:border-zinc-600"
        >
          <div className="font-medium text-sm">{lead.business}</div>
          <div className="text-xs text-emerald-400 mt-px">
            {lead.value} • {lead.score}/100
          </div>
          <div className="text-[10px] text-zinc-500 mt-4">{lead.lastActivity}</div>
        </div>
      ))}
      {leads.length === 0 && (
        <div className="text-xs text-zinc-600 text-center py-6">No leads</div>
      )}
    </div>
  );
}
