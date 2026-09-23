import React from 'react';
import { Logo } from '../brand/Logo';
import { GoogleDots } from '../brand/GoogleDots';
import { Monitor } from 'lucide-react';

export const DesktopOnlyNotice: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[200] md:hidden cs-canvas grid place-items-center px-5">
      <div className="w-full max-w-[400px] bg-[var(--cs-surface)] border border-[var(--cs-line)] rounded-lg p-7 cs-shadow text-center">
        <div className="flex flex-col items-center gap-2">
          <Logo size={32} withWordmark />
          <GoogleDots />
        </div>
        <Monitor className="w-8 h-8 text-[var(--cs-brand)] mx-auto mt-6" />
        <h1 className="mt-4 text-[22px] font-normal tracking-tight">Welcome to CloudSense AI</h1>
        <p className="mt-2 text-[14px] text-[var(--cs-ink-3)] leading-relaxed">
          This website is made for desktop. The console, forecasts, and approval workflows need a larger screen.
        </p>
        <p className="mt-3 text-[13px] text-[var(--cs-ink-2)] leading-relaxed">
          Please return on a desktop or laptop to continue.
        </p>
      </div>
    </div>
  );
};
