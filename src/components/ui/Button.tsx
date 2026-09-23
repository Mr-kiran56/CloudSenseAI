import React from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  className,
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-[4px] transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cs-brand)] disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const sizeStyles = {
    sm: 'h-8 px-3 text-[13px] gap-1.5',
    md: 'h-9 px-4 text-[13px] gap-2',
    lg: 'h-11 px-5 text-[14px] gap-2',
  };

  const variantStyles = {
    primary:
      'bg-[var(--cs-brand)] hover:bg-[var(--cs-brand-hover)] text-white dark:text-[#202124] dark:bg-[#8ab4f8] dark:hover:bg-[#aecbfa]',
    secondary:
      'bg-[var(--cs-muted)] hover:bg-[var(--cs-line)] text-[var(--cs-ink)]',
    outline:
      'border border-[var(--cs-line-strong)] bg-[var(--cs-surface)] text-[var(--cs-brand)] hover:bg-[var(--cs-brand-soft)]',
    ghost:
      'text-[var(--cs-ink-2)] hover:bg-[var(--cs-muted)] bg-transparent',
    danger:
      'bg-[var(--cs-crit)] text-white hover:opacity-90',
    success:
      'bg-[var(--cs-ok)] text-white hover:opacity-90',
  };

  return (
    <button
      className={clsx(baseStyles, sizeStyles[size], variantStyles[variant], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon ? <span className="flex items-center">{icon}</span> : null}
      {children}
    </button>
  );
};
