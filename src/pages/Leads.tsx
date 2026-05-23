import { useData } from '../context/DataContext';
import KanbanColumn from '../components/KanbanColumn';
import { LEAD_STAGES } from '../types';

export default function Leads() {
  const { leads } = useData();

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-3xl tracking-tight font-semibold mb-6">Pipeline</div>
        <div className="flex gap-3 overflow-x-auto pb-6">
          {LEAD_STAGES.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              leads={leads.filter((l) => l.stage === stage)}
            />
          ))}
        </div>
        {leads.length === 0 && (
          <div className="text-center text-zinc-500 text-sm mt-12">
            No leads yet. Discover businesses to build your pipeline.
          </div>
        )}
      </div>
    </div>
  );
}
