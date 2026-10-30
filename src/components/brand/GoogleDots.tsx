import React from 'react';
import { clsx } from 'clsx';

export const GoogleDots: React.FC<{ size?: 'sm' | 'md'; className?: string }> = ({ size = 'sm', className }) => {
  return (
    <span className={clsx('cs-gdots', size === 'md' && 'cs-gdots-md', className)} aria-hidden>
      <span className="cs-gdot" />
      <span className="cs-gdot" />
      <span className="cs-gdot" />
      <span className="cs-gdot" />
    </span>
  );
};
