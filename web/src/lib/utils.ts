import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date relative to now
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const target = new Date(date);
  const diffMs = now.getTime() - target.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return target.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a phone number for display
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length).trimEnd() + '...';
}

/**
 * Generate initials from a name
 */
export function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Sleep/delay utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a random ID
 */
export function generateId(prefix = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

/**
 * Check if we're on the server
 */
export const isServer = typeof window === 'undefined';

/**
 * Check if we're on the client
 */
export const isClient = !isServer;

/**
 * Lead status display names and colors
 */
export const leadStatusConfig: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  new: { label: 'New', color: 'text-accent-700', bgColor: 'bg-accent-100' },
  contacted: {
    label: 'Contacted',
    color: 'text-navy-700',
    bgColor: 'bg-navy-100',
  },
  qualified: {
    label: 'Qualified',
    color: 'text-success-700',
    bgColor: 'bg-success-100',
  },
  appointment_scheduled: {
    label: 'Scheduled',
    color: 'text-accent-700',
    bgColor: 'bg-accent-100',
  },
  estimate_sent: {
    label: 'Estimate Sent',
    color: 'text-warning-700',
    bgColor: 'bg-warning-100',
  },
  follow_up: {
    label: 'Follow Up',
    color: 'text-navy-700',
    bgColor: 'bg-navy-100',
  },
  won: { label: 'Won', color: 'text-success-700', bgColor: 'bg-success-100' },
  lost: { label: 'Lost', color: 'text-danger-700', bgColor: 'bg-danger-100' },
};

/**
 * Temperature display config
 */
export const temperatureConfig: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  hot: { label: 'Hot', color: 'text-danger-500', icon: 'flame' },
  warm: { label: 'Warm', color: 'text-warning-500', icon: 'sun' },
  cool: { label: 'Cool', color: 'text-navy-400', icon: 'snowflake' },
};
