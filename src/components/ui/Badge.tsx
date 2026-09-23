import React from 'react';
import { clsx } from 'clsx';
import { ShieldAlert, AlertTriangle, CheckCircle2, Info, Sparkles, Clock } from 'lucide-react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'critical' | 'info' | 'ai' | 'neutral';
  size?: 'sm' | 'md';
  icon?: boolean;
  title?: string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  icon = false,
  title,
  className,
}) => {
  const variantStyles = {
    default: 'bg-[var(--cs-muted)] text-[var(--cs-ink-2)] border-[var(--cs-line)]',
    success: 'bg-[var(--cs-ok-soft)] text-[var(--cs-ok)] border-transparent',
    warning: 'bg-[var(--cs-warn-soft)] text-[var(--cs-warn)] border-transparent',
    critical: 'bg-[var(--cs-crit-soft)] text-[var(--cs-crit)] border-transparent',
    info: 'bg-[var(--cs-brand-soft)] text-[var(--cs-brand)] border-transparent',
    ai: 'bg-[var(--cs-brand-soft)] text-[var(--cs-brand)] border-transparent',
    neutral: 'bg-[var(--cs-muted)] text-[var(--cs-ink-3)] border-[var(--cs-line)]',
  };

  const IconComponent = () => {
    if (!icon) return null;
    const cls = 'w-3 h-3 mr-1 shrink-0';
    switch (variant) {
      case 'success':
        return <CheckCircle2 className={cls} />;
      case 'warning':
        return <AlertTriangle className={cls} />;
      case 'critical':
        return <ShieldAlert className={cls} />;
      case 'info':
        return <Info className={cls} />;
      case 'ai':
        return <Sparkles className={cls} />;
      default:
        return <Clock className={cls} />;
    }
  };

  return (
    <span
      title={title}
      className={clsx(
        'inline-flex items-center font-medium border rounded-[4px] tabular-nums whitespace-nowrap',
        size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-[12px]',
        variantStyles[variant],
        className
      )}
    >
      <IconComponent />
      {children}
    </span>
  );
};

export const RiskBadge: React.FC<{ risk: 'low' | 'medium' | 'high' | 'critical' }> = ({ risk }) => {
  switch (risk) {
    case 'low':
      return (
        <Badge variant="success" icon title="Low operational risk if applied">
          Low risk
        </Badge>
      );
    case 'medium':
      return (
        <Badge variant="warning" icon title="Review performance impact before applying">
          Medium risk
        </Badge>
      );
    case 'high':
      return (
        <Badge variant="critical" icon title="May affect availability or latency">
          High risk
        </Badge>
      );
    case 'critical':
      return (
        <Badge variant="critical" icon title="Requires senior approval">
          Critical risk
        </Badge>
      );
  }
};

export const ConfidenceBadge: React.FC<{ confidence: number }> = ({ confidence }) => {
  const percent = Math.round(confidence * (confidence <= 1 ? 100 : 1));
  const variant = percent >= 90 ? 'success' : percent >= 75 ? 'info' : 'warning';
  const label = percent >= 90 ? 'High' : percent >= 75 ? 'Medium' : 'Low';

  return (
    <Badge variant={variant} title={`Model confidence ${percent}%. This is not a guarantee.`}>
      {label} · {percent}%
    </Badge>
  );
};
