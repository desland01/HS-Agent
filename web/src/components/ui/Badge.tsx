'use client';

import { cn } from '@/lib/utils';

type BadgeVariant =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'accent'
  | 'outline';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  dotColor?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  neutral: 'bg-navy-100 text-navy-700',
  success: 'bg-success-100 text-success-700',
  warning: 'bg-warning-100 text-warning-700',
  danger: 'bg-danger-100 text-danger-700',
  accent: 'bg-accent-100 text-accent-700',
  outline: 'bg-transparent border border-navy-200 text-navy-600',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-2xs',
  md: 'px-2.5 py-0.5 text-xs',
  lg: 'px-3 py-1 text-sm',
};

export function Badge({
  variant = 'neutral',
  size = 'md',
  dot,
  dotColor,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn('w-1.5 h-1.5 rounded-full', dotColor || 'bg-current')}
        />
      )}
      {children}
    </span>
  );
}

/**
 * Status badge specifically for lead statuses
 */
interface StatusBadgeProps {
  status: string;
  size?: BadgeSize;
}

const statusConfig: Record<
  string,
  { label: string; variant: BadgeVariant; dotColor?: string }
> = {
  new: { label: 'New', variant: 'accent', dotColor: 'bg-accent-500' },
  contacted: { label: 'Contacted', variant: 'neutral', dotColor: 'bg-navy-400' },
  qualified: {
    label: 'Qualified',
    variant: 'success',
    dotColor: 'bg-success-500',
  },
  appointment_scheduled: {
    label: 'Scheduled',
    variant: 'accent',
    dotColor: 'bg-accent-500',
  },
  estimate_sent: {
    label: 'Estimate Sent',
    variant: 'warning',
    dotColor: 'bg-warning-500',
  },
  follow_up: {
    label: 'Follow Up',
    variant: 'neutral',
    dotColor: 'bg-navy-400',
  },
  won: { label: 'Won', variant: 'success', dotColor: 'bg-success-500' },
  lost: { label: 'Lost', variant: 'danger', dotColor: 'bg-danger-500' },
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status] || {
    label: status,
    variant: 'neutral' as BadgeVariant,
  };

  return (
    <Badge variant={config.variant} size={size} dot dotColor={config.dotColor}>
      {config.label}
    </Badge>
  );
}

/**
 * Temperature indicator badge
 */
interface TemperatureBadgeProps {
  temperature: 'hot' | 'warm' | 'cool';
  size?: BadgeSize;
}

const tempConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  hot: { label: 'Hot', variant: 'danger' },
  warm: { label: 'Warm', variant: 'warning' },
  cool: { label: 'Cool', variant: 'neutral' },
};

export function TemperatureBadge({
  temperature,
  size = 'sm',
}: TemperatureBadgeProps) {
  const config = tempConfig[temperature];

  return (
    <Badge variant={config.variant} size={size}>
      {config.label}
    </Badge>
  );
}
