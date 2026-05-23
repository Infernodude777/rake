import { motion, AnimatePresence } from 'framer-motion';
import type { GeneratedSite } from '../types';

interface SiteEditorProps {
  open: boolean;
  site: GeneratedSite | null;
  onClose: () => void;
  onPublish: () => void;
}

export default function SiteEditor({ open, site, onClose, onPublish }: SiteEditorProps) {
  if (!site) return null;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-8" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-[980px] w-full bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-zinc-800 px-8 py-5 flex items-center justify-between">
              <div>
                <div className="font-semibold tracking-tight">{site.name}</div>
                <div className="text-xs text-zinc-500">Visual Editor • {site.variant}</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-6 py-2 rounded-full bg-zinc-900 text-sm hover:bg-zinc-800 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={onPublish}
                  className="px-6 py-2 rounded-full bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-colors"
                >
                  Publish Live
                </button>
              </div>
            </div>

            <div className="p-9 bg-zinc-900/70">
              <div className="aspect-video bg-zinc-950 rounded-2xl flex items-center justify-center border border-zinc-800">
                <div className="text-center max-w-sm">
                  <div className="font-medium text-3xl tracking-tight mb-3">{site.hero}</div>
                  <div className="text-emerald-400 text-sm">
                    AI-optimized hero section • {site.score} opportunity score
                  </div>
                  <div className="mt-8 flex justify-center gap-2 text-xs flex-wrap">
                    {site.issues.map((issue, idx) => (
                      <div key={idx} className="px-4 py-1 border border-white/20 rounded-full">
                        {issue}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="px-9 pb-9 flex items-center justify-between text-xs text-zinc-500">
              <span>AI-generated preview • {site.variant} variant</span>
              <span className="text-zinc-600">Visit the Websites tab to manage all your sites</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
