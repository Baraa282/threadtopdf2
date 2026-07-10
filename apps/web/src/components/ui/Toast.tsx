import { useToast } from '@/contexts/ToastContext';
import { cn } from '@/lib/utils';

const typeStyles = {
  success: 'border-green-200 bg-green-50 text-green-800 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-300',
  error: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300',
  info: 'border-border bg-surface-elevated text-[var(--color-text)]',
};

export function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg animate-slide-up min-w-[280px] max-w-sm',
            typeStyles[toast.type],
          )}
          role="status"
        >
          <p className="flex-1 text-sm">{toast.message}</p>
          <button
            onClick={() => dismissToast(toast.id)}
            className="shrink-0 opacity-60 hover:opacity-100"
            aria-label="Dismiss notification"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
