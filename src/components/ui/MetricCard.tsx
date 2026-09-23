import React from 'react';
import { clsx } from 'clsx';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Card } from './Card';

interface MetricCardProps {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: 'up' | 'down' | 'neutral' | 'good' | 'bad';
  hint?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  spark?: number[];
  accent?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  delta,
  deltaTone = 'neutral',
  hint,
  icon,
  onClick,
  spark,
  accent,
}) => {
  const toneClass =
    deltaTone === 'good' || deltaTone === 'down'
      ? 'text-[var(--cs-ok)]'
      : deltaTone === 'bad' || deltaTone === 'up'
        ? 'text-[var(--cs-crit)]'
        : 'text-[var(--cs-ink-3)]';

  const DeltaIcon =
    deltaTone === 'up' || deltaTone === 'bad'
      ? ArrowUpRight
      : deltaTone === 'down' || deltaTone === 'good'
        ? ArrowDownRight
        : Minus;

  return (
    <Card hoverable={Boolean(onClick)} onClick={onClick} className="p-3.5 overflow-hidden">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] text-[var(--cs-ink-3)]">{label}</p>
        {icon && <span className="text-[var(--cs-ink-3)]">{icon}</span>}
      </div>
      <p className="mt-1.5 text-[22px] leading-7 font-medium tabular-nums tracking-tight text-[var(--cs-ink)]">
        {value}
      </p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        {delta ? (
          <span className={clsx('inline-flex items-center text-[11px] font-medium tabular-nums', toneClass)}>
            <DeltaIcon className="w-3 h-3" />
            {delta}
          </span>
        ) : (
          <span />
        )}
        {spark && spark.length > 1 && (
          <svg width="64" height="18" viewBox="0 0 64 18" className="text-[var(--cs-brand)]" aria-hidden>
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              points={spark
                .map((v, i) => {
                  const min = Math.min(...spark);
                  const max = Math.max(...spark);
                  const x = (i / (spark.length - 1)) * 64;
                  const y = 16 - ((v - min) / (max - min || 1)) * 14;
                  return `${x},${y}`;
                })
                .join(' ')}
            />
          </svg>
        )}
      </div>
      {hint && <p className="mt-1 text-[11px] text-[var(--cs-ink-3)]">{hint}</p>}
    </Card>
  );
};
