import { cn } from '@/lib/utils';

interface ErrorAlertProps {
  title?: string;
  message: string;
  className?: string;
  onDismiss?: () => void;
}

export function ErrorAlert({ title = 'Error', message, className, onDismiss }: ErrorAlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30',
        className,
      )}
    >
      <svg
        className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-red-800 dark:text-red-300">{title}</p>
        <p className="mt-1 text-sm text-red-700 dark:text-red-400">{message}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
          aria-label="Dismiss error"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
