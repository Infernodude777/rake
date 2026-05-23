import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface CommandItem {
  label: string;
  cmd: string;
}

const COMMANDS: CommandItem[] = [
  { label: 'Search businesses', cmd: 'discover' },
  { label: 'Open leads pipeline', cmd: 'leads' },
  { label: 'Generate website from last scrape', cmd: 'discover' },
  { label: 'Deploy latest site', cmd: 'websites' },
  { label: 'Open settings', cmd: 'settings' },
  { label: 'View analytics', cmd: 'analytics' },
  { label: 'Go to dashboard', cmd: 'dashboard' },
];

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onExecute: (cmd: string) => void;
}

export default function CommandPalette({ open, onClose, onExecute }: CommandPaletteProps) {
  const [query, setQuery] = useState('');

  const filtered = COMMANDS.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  const handleExecute = (cmd: string) => {
    setQuery('');
    onExecute(cmd);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center pt-[22vh]" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="bg-zinc-900 border border-zinc-700 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              placeholder="Search commands..."
              className="w-full px-6 py-4 bg-transparent border-b border-zinc-800 text-lg placeholder:text-zinc-500 focus:outline-none"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <div className="p-2 text-sm max-h-72 overflow-auto">
              {filtered.map((c, i) => (
                <div
                  key={i}
                  onClick={() => handleExecute(c.cmd)}
                  className="px-5 py-3.5 hover:bg-zinc-800 cursor-pointer flex items-center gap-3 rounded-2xl transition-colors"
                >
                  <ArrowRight size={15} className="text-zinc-500" />
                  {c.label}
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="px-5 py-6 text-zinc-500 text-center text-xs">No commands match</div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
