import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Unable to load cloud data',
  message = 'An unexpected error occurred while communicating with the CloudSense AI engine or AWS SDK services.',
  onRetry,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-10 text-center bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-xl space-y-3">
      <div className="p-3 bg-rose-100 dark:bg-rose-900/50 rounded-full text-rose-600 dark:text-rose-400">
        <AlertTriangle className="w-7 h-7" />
      </div>
      <h3 className="text-base font-semibold text-rose-900 dark:text-rose-200">{title}</h3>
      <p className="text-xs text-rose-700 dark:text-rose-400 max-w-md">{message}</p>
      {onRetry && (
        <div className="pt-2">
          <Button variant="outline" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={onRetry}>
            Retry Request
          </Button>
        </div>
      )}
    </div>
  );
};
