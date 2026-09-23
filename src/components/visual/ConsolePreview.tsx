import React from 'react';

export const ConsolePreview: React.FC = () => {
  return (
    <div className="cs-console-preview rounded-lg overflow-hidden border border-[var(--cs-line)] shadow-lg bg-[var(--cs-surface)]" aria-hidden>
      <div className="flex items-center gap-2 h-9 px-3 border-b border-[var(--cs-line)] bg-[var(--cs-muted)]">
        <span className="h-2.5 w-2.5 rounded-full bg-[#EA4335]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#FBBC05]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#34A853]" />
        <span className="ml-2 h-6 flex-1 rounded-[4px] bg-[var(--cs-surface)] border border-[var(--cs-line)] text-[11px] text-[var(--cs-ink-3)] px-2.5 flex items-center truncate">
          console.cloudsense.ai/dashboard
        </span>
      </div>

      <div className="grid grid-cols-[72px_1fr] min-h-[320px]">
        <div className="border-r border-[var(--cs-line)] bg-[var(--cs-surface)] py-3 px-2 space-y-2">
          <div className="h-7 rounded-[4px] bg-[var(--cs-brand-soft)] opacity-80" />
          <div className="h-7 rounded-[4px] bg-[var(--cs-muted)]" />
          <div className="h-7 rounded-[4px] bg-[var(--cs-muted)]" />
          <div className="h-7 rounded-[4px] bg-[var(--cs-muted)]" />
          <div className="h-7 rounded-[4px] bg-[var(--cs-muted)]" />
        </div>

        <div className="p-3 bg-[var(--cs-bg)] space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'MTD spend', value: '$24,680', hint: '+8.4% vs prior' },
              { label: 'Prophet forecast', value: '$29,120', hint: 'Month-end' },
              { label: 'Savings queued', value: '$6,840', hint: '4 actions' },
            ].map((m) => (
              <div key={m.label} className="bg-[var(--cs-surface)] border border-[var(--cs-line)] rounded-[4px] p-2">
                <p className="text-[10px] text-[var(--cs-ink-3)]">{m.label}</p>
                <p className="text-[13px] font-medium tabular-nums mt-0.5 text-[var(--cs-ink)]">{m.value}</p>
                <p className="text-[10px] text-[var(--cs-ink-3)]">{m.hint}</p>
              </div>
            ))}
          </div>

          <div className="bg-[var(--cs-surface)] border border-[var(--cs-line)] rounded-[4px] p-2.5">
            <p className="text-[11px] font-medium text-[var(--cs-ink)]">Spend vs Prophet forecast</p>
            <svg viewBox="0 0 280 88" className="mt-2 w-full h-[88px]" role="presentation">
              <polyline
                fill="none"
                stroke="var(--cs-line)"
                strokeWidth="1"
                points="0,70 40,70 80,70 120,70 160,70 200,70 240,70 280,70"
              />
              <polyline
                className="cs-console-line"
                fill="none"
                stroke="var(--cs-brand)"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                points="4,62 28,58 52,60 76,48 100,50 124,38 148,42 172,28 196,32 220,22 244,26 272,18"
              />
              <polyline
                fill="none"
                stroke="var(--cs-ink-3)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                points="148,42 172,36 196,34 220,30 244,28 272,24"
              />
            </svg>
          </div>

          <div className="bg-[var(--cs-surface)] border border-[var(--cs-line)] rounded-[4px] px-2.5 py-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-medium truncate text-[var(--cs-ink)]">Resize payment-processing-worker-04</p>
              <p className="text-[10px] text-[var(--cs-ink-3)]">c5.4xlarge → c5.xlarge · +$248 / mo</p>
            </div>
            <span className="shrink-0 h-6 px-2 rounded-[4px] bg-[var(--cs-brand)] text-white text-[10px] font-medium grid place-items-center">
              Review
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
