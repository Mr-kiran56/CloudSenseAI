import React from 'react';
import { clsx } from 'clsx';

export const PageHeader: React.FC<{
  title: string;
  description?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}> = ({ title, description, actions, eyebrow }) => {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between pb-4 mb-1 border-b border-[var(--cs-line)]">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--cs-ink-3)] mb-1">
            {eyebrow}
          </p>
        )}
        <h1 className="text-[22px] leading-7 font-normal text-[var(--cs-ink)] tracking-tight">{title}</h1>
        {description && (
          <p className="text-[13px] text-[var(--cs-ink-3)] mt-1 max-w-3xl leading-relaxed">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
};

export const SegmentedControl: React.FC<{
  options: string[];
  value: string;
  onChange: (value: string) => void;
}> = ({ options, value, onChange }) => {
  return (
    <div
      role="tablist"
      className="inline-flex items-center rounded-[4px] border border-[var(--cs-line)] bg-[var(--cs-surface)] p-0.5"
    >
      {options.map((option) => (
        <button
          key={option}
          role="tab"
          aria-selected={value === option}
          onClick={() => onChange(option)}
          className={clsx(
            'h-7 px-2.5 text-[12px] rounded-[3px] transition-colors',
            value === option
              ? 'bg-[var(--cs-brand-soft)] text-[var(--cs-brand)] font-medium'
              : 'text-[var(--cs-ink-3)] hover:text-[var(--cs-ink)]'
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
};

export const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="inline-flex items-center h-5 px-1.5 rounded-[3px] border border-[var(--cs-line)] bg-[var(--cs-muted)] text-[10px] font-mono text-[var(--cs-ink-3)]">
    {children}
  </kbd>
);

export const DemoBanner: React.FC<{ className?: string }> = ({ className }) => (
  <div
    className={clsx(
      'inline-flex items-center gap-1.5 h-6 px-2 rounded-[4px] bg-[var(--cs-warn-soft)] text-[var(--cs-warn)] text-[11px] font-medium',
      className
    )}
    title="Figures are labeled demo data until a live backend is connected"
  >
    <span className="w-1.5 h-1.5 rounded-full bg-[var(--cs-warn)]" />
    Demo data
  </div>
);
