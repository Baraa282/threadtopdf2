import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated';
}

export function Card({ className, variant = 'default', children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border p-6 sm:p-8',
        variant === 'default' && 'bg-surface',
        variant === 'elevated' && 'bg-surface-elevated shadow-lg shadow-black/5 dark:shadow-black/20',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
