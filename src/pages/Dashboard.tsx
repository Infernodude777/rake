import { Plus } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useData } from '../context/DataContext';
import StatCard from '../components/StatCard';
import ActivityFeed from '../components/ActivityFeed';
import { buildDailyData } from '../utils/chartData';
import type { DashboardStat } from '../types';

/** Build lead quality distribution from actual lead scores */
function buildPieData(leads: { score: number }[]) {
  if (leads.length === 0) {
    return [{ name: 'No Data', value: 1, fill: '#334155' }];
  }
  const high = leads.filter((l) => l.score >= 75).length;
  const medium = leads.filter((l) => l.score >= 50 && l.score < 75).length;
  const low = leads.filter((l) => l.score < 50).length;

  return [
    { name: 'High (75+)', value: high, fill: '#a78bfa' },
    { name: 'Medium (50-74)', value: medium, fill: '#64748b' },
    { name: 'Low (<50)', value: low, fill: '#334155' },
  ].filter((d) => d.value > 0);
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning.';
  if (h < 17) return 'Good afternoon.';
  return 'Good evening.';
}

interface DashboardProps {
  onNavigate: (page: string) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { businesses, leads, websites, notifications } = useData();

  const dailyData = buildDailyData(businesses, leads, websites);
  const pieData = buildPieData(leads);

  const stats: DashboardStat[] = [
    { label: 'Leads Discovered', value: businesses.length.toString(), change: `+${leads.length}` },
    { label: 'Websites Generated', value: websites.length.toString(), change: `+${websites.filter((w) => w.status !== 'draft').length}` },
    {
      label: 'Reply Rate',
      value: leads.length > 0 ? `${Math.round((leads.filter((l) => l.stage !== 'discovered').length / leads.length) * 100)}%` : '0%',
      change: '+0%',
    },
    {
      label: 'Pipeline Value',
      value: leads.length > 0
        ? `$${(leads.reduce((acc, l) => acc + (parseInt(l.value.replace(/[^0-9]/g, '')) || 0), 0) / 1000).toFixed(1)}k`
        : '$0',
      change: '',
    },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <div className="text-4xl tracking-[-1.5px] font-semibold">{greeting()}</div>
          <div className="text-zinc-400 mt-1">
            {businesses.length > 0
              ? `${businesses.length} opportunities identified • ${leads.filter((l) => l.stage === 'won').length} won`
              : 'Search for businesses to get started'}
          </div>
        </div>
        <button
          onClick={() => onNavigate('discover')}
          className="flex items-center gap-2 px-5 py-2 bg-white text-black rounded-2xl text-sm font-medium hover:bg-zinc-200 transition-colors"
        >
          <Plus size={16} /> New Campaign
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <StatCard key={i} {...stat} />
        ))}
      </div>

      <div className="grid grid-cols-7 gap-4">
        <div className="col-span-4 bg-zinc-900 border border-zinc-800 rounded-3xl p-7">
          <div className="font-medium mb-6 flex justify-between">
            Activity <span className="text-xs text-zinc-500">Last 7 days</span>
          </div>
          {dailyData.some((d) => d.leads || d.websites || d.outreach) ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="2 2" stroke="#27272a" />
                <XAxis dataKey="name" stroke="#3f3f46" />
                <YAxis stroke="#3f3f46" allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff' }} />
                <Line type="natural" dataKey="leads" stroke="#a78bfa" strokeWidth={3} dot={false} />
                <Line type="natural" dataKey="websites" stroke="#64748b" strokeWidth={2} dot={false} />
                <Line type="natural" dataKey="outreach" stroke="#34d399" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-zinc-500 text-sm">
              Discover businesses to see activity over time
            </div>
          )}
        </div>

        <div className="col-span-3 bg-zinc-900 border border-zinc-800 rounded-3xl p-7">
          <div className="font-medium mb-5">Lead Quality Distribution</div>
          <div className="h-60 flex items-center justify-center">
            {leads.length > 0 ? (
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={65} outerRadius={95}>
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-zinc-500 text-sm">No leads yet</div>
            )}
          </div>
          {leads.length > 0 && (
            <div className="flex justify-center gap-6 text-[10px] text-zinc-500 mt-2">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#a78bfa]" /> High</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#64748b]" /> Medium</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#334155]" /> Low</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4">
        <ActivityFeed notifications={notifications} />
      </div>
    </div>
  );
}
