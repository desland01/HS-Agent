---
name: Design System
description: UI/UX standards, typography, colors, and component patterns for consistent interfaces
---

# Design System Skill

Standards and patterns for building consistent, accessible user interfaces.

## Design Principles

1. **Clarity**: Every element should have a clear purpose
2. **Consistency**: Same patterns for same problems
3. **Accessibility**: WCAG 2.1 AA compliance minimum
4. **Performance**: Optimize for perceived speed
5. **Responsiveness**: Mobile-first approach

## Typography

### Font Stack

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

### Type Scale

| Name | Size | Weight | Line Height | Use Case |
|------|------|--------|-------------|----------|
| `xs` | 12px | 400 | 1.5 | Labels, captions |
| `sm` | 14px | 400 | 1.5 | Secondary text |
| `base` | 16px | 400 | 1.5 | Body text |
| `lg` | 18px | 500 | 1.4 | Subheadings |
| `xl` | 20px | 600 | 1.3 | Section titles |
| `2xl` | 24px | 700 | 1.2 | Page titles |
| `3xl` | 30px | 700 | 1.1 | Hero text |

## Color System

### Primary Palette

```css
--primary-50:  #eff6ff;
--primary-100: #dbeafe;
--primary-200: #bfdbfe;
--primary-300: #93c5fd;
--primary-400: #60a5fa;
--primary-500: #3b82f6;  /* Main */
--primary-600: #2563eb;
--primary-700: #1d4ed8;
--primary-800: #1e40af;
--primary-900: #1e3a8a;
```

### Semantic Colors

```css
--success: #10b981;
--warning: #f59e0b;
--error:   #ef4444;
--info:    #3b82f6;
```

### Neutral Palette

```css
--gray-50:  #f9fafb;
--gray-100: #f3f4f6;
--gray-200: #e5e7eb;
--gray-300: #d1d5db;
--gray-400: #9ca3af;
--gray-500: #6b7280;
--gray-600: #4b5563;
--gray-700: #374151;
--gray-800: #1f2937;
--gray-900: #111827;
```

## Spacing System

Use a 4px base unit:

```css
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

## Component Patterns

### Buttons

```
Primary:   Solid background, white text
Secondary: Outlined, primary text
Ghost:     No background, subtle hover
Danger:    Red background for destructive actions
```

Button sizes: `sm` (32px), `md` (40px), `lg` (48px)

### Forms

- Labels above inputs (not inline)
- Clear error states with red border + message
- Helper text in gray below input
- Required fields marked with asterisk
- Validation on blur, not on type

### Cards

- 8px border radius
- Subtle shadow: `0 1px 3px rgba(0,0,0,0.1)`
- 16-24px padding
- Clear visual hierarchy

### Modals

- Centered with backdrop
- Max width: 480px (sm), 640px (md), 800px (lg)
- Clear close button
- Focus trap for accessibility
- Escape key to close

## Responsive Breakpoints

```css
--sm:  640px;   /* Mobile landscape */
--md:  768px;   /* Tablet */
--lg:  1024px;  /* Desktop */
--xl:  1280px;  /* Large desktop */
--2xl: 1536px;  /* Wide screens */
```

## Accessibility Checklist

- [ ] Color contrast ratio >= 4.5:1 for text
- [ ] Touch targets >= 44x44px
- [ ] Focus indicators visible
- [ ] Labels for all form inputs
- [ ] Alt text for images
- [ ] Keyboard navigable
- [ ] Screen reader tested

## Animation Guidelines

- Duration: 150-300ms for UI feedback
- Easing: `ease-out` for entrances, `ease-in` for exits
- Respect `prefers-reduced-motion`
- Avoid animation on page load

## Icons

Use Lucide icons for consistency:
- Size: 16px (inline), 20px (buttons), 24px (standalone)
- Stroke width: 2px
- Always include accessible label
