import { useEffect } from 'react';

type KeyHandler = (e: KeyboardEvent) => void;

interface Shortcut {
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  handler: KeyHandler;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[], deps: any[] = []) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const metaDown = e.metaKey || e.ctrlKey;
        const requiresMeta = shortcut.meta || shortcut.ctrl;

        if (e.key === shortcut.key) {
          if (requiresMeta && !metaDown) continue;
          if (!requiresMeta && metaDown) continue;
          e.preventDefault();
          shortcut.handler(e);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, ...deps]);
}
