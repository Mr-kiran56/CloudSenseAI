import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Kbd } from './PageHeader';

const rows = [
  ['Open command palette', 'Ctrl / ⌘ K'],
  ['Keyboard shortcuts', 'Ctrl / ⌘ /'],
  ['Close dialog', 'Esc'],
  ['Move in lists', '↑ ↓'],
  ['Open selected', 'Enter'],
];

export const KeyboardShortcuts: React.FC = () => {
  const { shortcutsOpen, setShortcutsOpen } = useApp();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShortcutsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setShortcutsOpen]);

  if (!shortcutsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/40">
      <div
        role="dialog"
        aria-labelledby="shortcuts-title"
        className="w-full max-w-md bg-[var(--cs-surface)] border border-[var(--cs-line)] rounded-lg cs-shadow-md"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--cs-line)]">
          <h2 id="shortcuts-title" className="text-[15px] font-medium">
            Keyboard shortcuts
          </h2>
          <button className="p-1 rounded-[4px] hover:bg-[var(--cs-muted)]" onClick={() => setShortcutsOpen(false)}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <ul className="p-2">
          {rows.map(([label, keys]) => (
            <li key={label} className="flex items-center justify-between px-3 py-2 text-[13px]">
              <span>{label}</span>
              <Kbd>{keys}</Kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
