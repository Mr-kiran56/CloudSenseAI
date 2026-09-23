import React from 'react';
import { clsx } from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
  padding?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  onClick,
  hoverable = false,
  padding = true,
}) => {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-[var(--cs-surface)] border border-[var(--cs-line)] rounded-lg',
        padding && 'p-4',
        hoverable && 'hover:border-[var(--cs-line-strong)] hover:cs-shadow cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, action, className }) => {
  return (
    <div className={clsx('flex items-start justify-between gap-3 mb-4', className)}>
      <div className="min-w-0">
        <h3 className="text-[14px] font-medium text-[var(--cs-ink)] tracking-tight">{title}</h3>
        {subtitle && (
          <p className="text-[12px] text-[var(--cs-ink-3)] mt-0.5 leading-relaxed">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};
