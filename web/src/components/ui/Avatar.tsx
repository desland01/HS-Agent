'use client';

import { cn, getInitials } from '@/lib/utils';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: AvatarSize;
  className?: string;
}

const sizeStyles: Record<AvatarSize, string> = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
};

// Generate a consistent color based on name
function getAvatarColor(name: string): string {
  const colors = [
    'bg-accent-500',
    'bg-navy-600',
    'bg-success-500',
    'bg-warning-500',
    'bg-danger-500',
    'bg-navy-500',
  ];

  if (!name) return colors[0];

  const charSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return colors[charSum % colors.length];
}

export function Avatar({
  src,
  alt,
  name = '',
  size = 'md',
  className,
}: AvatarProps) {
  const initials = getInitials(name);
  const bgColor = getAvatarColor(name);

  if (src) {
    return (
      <div
        className={cn(
          'relative rounded-full overflow-hidden bg-navy-100 shrink-0',
          sizeStyles[size],
          className
        )}
      >
        <img
          src={src}
          alt={alt || name}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full font-medium text-white shrink-0',
        sizeStyles[size],
        bgColor,
        className
      )}
    >
      {initials}
    </div>
  );
}

interface AvatarGroupProps {
  children: React.ReactNode;
  max?: number;
  size?: AvatarSize;
  className?: string;
}

export function AvatarGroup({
  children,
  max = 4,
  size = 'md',
  className,
}: AvatarGroupProps) {
  const childArray = Array.isArray(children) ? children : [children];
  const visible = childArray.slice(0, max);
  const overflow = childArray.length - max;

  return (
    <div className={cn('flex -space-x-2', className)}>
      {visible.map((child, index) => (
        <div
          key={index}
          className="relative ring-2 ring-white rounded-full"
          style={{ zIndex: visible.length - index }}
        >
          {child}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className={cn(
            'relative flex items-center justify-center rounded-full bg-navy-200 text-navy-600 font-medium ring-2 ring-white',
            sizeStyles[size]
          )}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
