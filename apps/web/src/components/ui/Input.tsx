import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full rounded-xl border bg-surface px-4 py-3.5 text-base text-[var(--color-text)]',
          'placeholder:text-muted transition-colors duration-200',
          'focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-gray-100/10',
          error ? 'border-red-500' : 'border-border hover:border-gray-300 dark:hover:border-gray-600',
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = 'Input';
