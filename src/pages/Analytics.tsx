import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useData } from '../context/DataContext';
import { buildDailyData } from '../utils/chartData';

export default function Analytics() {
  const { businesses, leads, websites } = useData();
  const dailyData = buildDailyData(businesses, leads, websites);
  const hasData = dailyData.some((d) => d.leads || d.websites || d.outreach);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="text-4xl font-semibold tracking-tight mb-6">Performance</div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
          <div className="text-zinc-400 text-xs">Total Businesses</div>
          <div className="text-3xl font-semibold mt-1">{businesses.length}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
          <div className="text-zinc-400 text-xs">Active Leads</div>
          <div className="text-3xl font-semibold mt-1">{leads.length}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
          <div className="text-zinc-400 text-xs">Websites Built</div>
          <div className="text-3xl font-semibold mt-1">{websites.length}</div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-9">
        <div className="font-medium mb-6">Activity (Last 7 Days)</div>
        {hasData ? (
          <ResponsiveContainer height={300}>
            <BarChart data={dailyData}>
              <CartesianGrid stroke="#27272a" />
              <XAxis dataKey="name" stroke="#3f3f46" />
              <YAxis stroke="#3f3f46" allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff' }} />
              <Bar dataKey="leads" fill="#a78bfa" radius={4} name="Leads" />
              <Bar dataKey="websites" fill="#64748b" radius={4} name="Websites" />
              <Bar dataKey="outreach" fill="#34d399" radius={4} name="Outreach" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-72 flex items-center justify-center text-zinc-500 text-sm">
            Discover businesses to see activity data
          </div>
        )}
      </div>
    </div>
  );
}
