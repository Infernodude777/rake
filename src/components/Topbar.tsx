import { Bell, Command } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useState, useRef, useEffect } from 'react';

interface TopbarProps {
  onOpenCommand: () => void;
}

export default function Topbar({ onOpenCommand }: TopbarProps) {
  const { notifications, markAllNotificationsRead, settings } = useData();
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="h-14 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-6 text-sm">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-zinc-900 rounded-xl px-3 py-1 text-xs border border-zinc-800">
          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          Workspace: <span className="font-medium">{settings.workspaceName}</span>
        </div>
        <button
          onClick={onOpenCommand}
          className="flex items-center gap-2 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-xl text-xs hover:bg-zinc-800 transition-colors"
        >
          <Command size={14} /> Cmd+K
        </button>
      </div>

      <div className="flex items-center gap-5 text-xs">
        <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full">
          <div className="text-emerald-400">●</div> BYO Infrastructure
        </div>
        <div className="relative" ref={notifRef}>
          <button onClick={() => setShowNotifs(!showNotifs)} className="relative">
            <Bell size={15} />
            {unreadCount > 0 && (
              <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-medium">
                {unreadCount}
              </div>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-8 w-80 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                <span className="text-xs font-medium">Notifications</span>
                {unreadCount > 0 && (
                  <button onClick={markAllNotificationsRead} className="text-[10px] text-zinc-400 hover:text-white">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-zinc-500 text-xs">No notifications</div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className={`px-4 py-3 border-b border-zinc-800 last:border-none ${!n.read ? 'bg-zinc-800/30' : ''}`}>
                      <div className="text-xs">{n.message}</div>
                      <div className="text-[10px] text-zinc-500 mt-1">{n.time}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 pl-3 border-l border-zinc-800">
          <div className="w-6 h-6 bg-zinc-700 rounded-full flex items-center justify-center text-[10px] font-medium">
            {settings.userName[0] || 'U'}
          </div>
          <span className="font-medium">{settings.userName}</span>
        </div>
      </div>
    </div>
  );
}
