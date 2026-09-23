import React from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ToastContainer } from '../ui/ToastContainer';
import { CommandPalette } from '../ui/CommandPalette';
import { KeyboardShortcuts } from '../ui/KeyboardShortcuts';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex h-screen w-screen overflow-hidden cs-canvas text-[var(--cs-ink)]">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-5 md:px-6 md:py-6 space-y-5">{children}</div>
        </main>
      </div>
      <CommandPalette />
      <KeyboardShortcuts />
      <ToastContainer />
    </div>
  );
};
