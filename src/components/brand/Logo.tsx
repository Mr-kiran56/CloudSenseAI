import React from 'react';
import { clsx } from 'clsx';

interface LogoProps {
  size?: number;
  withWordmark?: boolean;
  inverted?: boolean;
  compact?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  size = 28,
  withWordmark = false,
  inverted = false,
  compact = false,
}) => {
  return (
    <span className="inline-flex items-center gap-2.5 min-w-0">
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden
        className="shrink-0"
      >
        <rect width="32" height="32" rx="6" fill={inverted ? '#fff' : '#5b7cfa'} />
        <path
          d="M8 20.5c0-4.4 3.6-8 8-8s8 3.6 8 8"
          stroke={inverted ? '#5b7cfa' : '#fff'}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M12 20.5c0-2.2 1.8-4 4-4s4 1.8 4 4"
          stroke={inverted ? '#5b7cfa' : '#fff'}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <circle cx="16" cy="21" r="1.8" fill={inverted ? '#5b7cfa' : '#fff'} />
      </svg>
      {withWordmark && (
        <span className="min-w-0 leading-tight">
          <span
            className={clsx(
              'block font-medium tracking-tight',
              compact ? 'text-[13px]' : 'text-[15px]',
              inverted ? 'text-white' : 'text-[var(--cs-ink)]'
            )}
          >
            CloudSense AI
          </span>
          {!compact && (
            <span
              className={clsx(
                'block text-[11px]',
                inverted ? 'text-white/70' : 'text-[var(--cs-ink-3)]'
              )}
            >
              Cloud intelligence
            </span>
          )}
        </span>
      )}
    </span>
  );
};
