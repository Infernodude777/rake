import type { Notification } from '../types';

interface ActivityFeedProps {
  notifications: Notification[];
}

export default function ActivityFeed({ notifications }: ActivityFeedProps) {
  if (notifications.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-7">
        <div className="font-medium mb-4">Live Activity Feed</div>
        <div className="text-zinc-500 text-sm text-center py-6">No activity yet</div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-7">
      <div className="font-medium mb-4">Live Activity Feed</div>
      <div className="space-y-px text-sm">
        {notifications.slice(0, 8).map((n) => (
          <div key={n.id} className="flex justify-between py-3 border-b border-zinc-800 last:border-none">
            <div className="flex items-center gap-2">
              {!n.read && <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full flex-shrink-0" />}
              <span className={!n.read ? 'font-medium' : 'text-zinc-400'}>{n.message}</span>
            </div>
            <div className="text-zinc-500 flex-shrink-0 ml-4">{n.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
