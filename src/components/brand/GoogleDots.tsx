import React from 'react';
import { clsx } from 'clsx';

export const GoogleDots: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'sm' }) => {
  return (
    <span className={clsx('cs-gdots', size === 'md' && 'cs-gdots-md')} aria-hidden>
      <span className="cs-gdot" />
      <span className="cs-gdot" />
      <span className="cs-gdot" />
      <span className="cs-gdot" />
    </span>
  );
};
