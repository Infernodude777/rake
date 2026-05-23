interface StatCardProps {
  label: string;
  value: string;
  change: string;
}

export default function StatCard({ label, value, change }: StatCardProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
      <div className="text-zinc-400 text-sm">{label}</div>
      <div className="text-4xl font-semibold tracking-tighter mt-2">{value}</div>
      <div className="text-emerald-400 text-xs mt-1">{change} from last week</div>
    </div>
  );
}
