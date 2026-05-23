import { BarChart3, Search, Users, Globe, Mail, TrendingUp, Settings, Command } from 'lucide-react';
import type { NavItem } from '../types';
import { useData } from '../context/DataContext';

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'discover', label: 'Discover', icon: Search },
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'websites', label: 'Websites', icon: Globe },
  { id: 'outreach', label: 'Outreach', icon: Mail },
  { id: 'analytics', label: 'Analytics', icon: TrendingUp },
  { id: 'settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
  onOpenCommand: () => void;
}

export default function Sidebar({ activePage, onNavigate, onOpenCommand }: SidebarProps) {
  const { settings } = useData();

  return (
    <div className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col">
      <div className="p-6 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
            <span className="text-zinc-950 font-semibold text-xl tracking-tighter">RK</span>
          </div>
          <div>
            <div className="font-semibold tracking-tight text-xl">RAKE</div>
            <div className="text-[10px] text-zinc-500 -mt-0.5">AI CLIENT OS</div>
          </div>
        </div>
      </div>

      <div className="p-3 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm rounded-xl transition-all ${
                activePage === item.id
                  ? 'bg-zinc-800 text-white'
                  : 'hover:bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              <Icon size={17} />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="mt-auto p-4 border-t border-zinc-800 space-y-2">
        <button
          onClick={onOpenCommand}
          className="w-full flex items-center gap-2 px-4 py-2 text-xs text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800/50 transition-all"
        >
          <Command size={14} /> Quick commands
        </button>
        <div className="text-[10px] text-zinc-500 px-4">
          {settings.workspaceName} • BYO Infrastructure
        </div>
      </div>
    </div>
  );
}
