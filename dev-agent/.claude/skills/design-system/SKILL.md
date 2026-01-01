---
name: design-system
description: Distinctive UI/UX standards - typography, colors, motion, layout patterns
triggers: [ui, frontend, dashboard, component, design, styling, tailwind, css]
priority: 2
alwaysLoad: false
---

# Design System Skill

Build distinctive, memorable interfaces. **NEVER produce generic AI aesthetics.**

## Core Principles

1. **Distinctive over safe** - Bold choices that stand out
2. **Intentional asymmetry** - Break the grid purposefully
3. **Motion as personality** - Animations convey brand character
4. **Density when appropriate** - Information-rich where users need it

## Typography

### Font Stack (from PRD)

```css
/* Headings - distinctive, modern */
--font-heading: 'Outfit', 'DM Sans', sans-serif;

/* Body - readable with character */
--font-body: 'Satoshi', sans-serif;

/* Mono - code blocks */
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

### NEVER USE
- Inter
- Roboto
- Arial
- System fonts (-apple-system, BlinkMacSystemFont)

### Type Scale

| Name | Size | Weight | Use Case |
|------|------|--------|----------|
| `xs` | 12px | 400 | Labels, metadata |
| `sm` | 14px | 400 | Secondary text |
| `base` | 16px | 400 | Body text |
| `lg` | 18px | 500 | Subheadings |
| `xl` | 24px | 600 | Section titles |
| `2xl` | 32px | 700 | Page titles |
| `3xl` | 48px | 800 | Hero text |

## Color System (from PRD)

### Primary Palette

```css
/* Deep navy - primary background/text */
--primary: #0F172A;
--primary-light: #1E293B;
--primary-dark: #020617;

/* Warm orange - accent, CTAs */
--accent: #F97316;
--accent-light: #FB923C;
--accent-dark: #EA580C;
```

### NEVER USE
- Purple gradients on white (cliched AI aesthetic)
- Pastel rainbow gradients
- Generic blue (#007bff, #0066cc)

### Semantic Colors

```css
--success: #10B981;  /* Emerald */
--warning: #F59E0B;  /* Amber */
--error: #EF4444;    /* Red */
--info: #0EA5E9;     /* Sky */
```

### Neutral Palette

```css
--slate-50:  #F8FAFC;
--slate-100: #F1F5F9;
--slate-200: #E2E8F0;
--slate-300: #CBD5E1;
--slate-400: #94A3B8;
--slate-500: #64748B;
--slate-600: #475569;
--slate-700: #334155;
--slate-800: #1E293B;
--slate-900: #0F172A;
```

## Motion & Animation

### Principles (from PRD)

1. **Staggered reveals** - Elements enter sequentially on page load
2. **Spring physics** - Natural, bouncy interactions
3. **Meaningful hover states** - Every interactive element responds
4. **Scroll-triggered animations** - Content animates as it enters viewport

### Framer Motion Patterns

```tsx
// Staggered container
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

// Spring item
const item = {
  hidden: { y: 20, opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 300, damping: 24 }
  }
};

// Hover scale
whileHover={{ scale: 1.02 }}
whileTap={{ scale: 0.98 }}
```

### Timing

- Micro-interactions: 150-200ms
- Page transitions: 300-400ms
- Complex sequences: 600-800ms
- Always respect `prefers-reduced-motion`

## Layout Patterns

### Philosophy (from PRD)

- **Intentional asymmetry over rigid grids**
- **Generous negative space** (or controlled density for dashboards)
- **Layered depth with subtle shadows**
- **Unexpected element placement**

### Backgrounds

```css
/* Gradient mesh */
background: radial-gradient(at 40% 20%, #0F172A 0%, transparent 50%),
            radial-gradient(at 80% 80%, #1E293B 0%, transparent 40%);

/* Noise texture overlay */
background-image: url('/noise.svg');
opacity: 0.03;

/* Layered transparencies */
backdrop-filter: blur(12px);
background: rgba(15, 23, 42, 0.8);
```

### Shadows

```css
/* Subtle elevation */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
--shadow-glow: 0 0 20px rgba(249, 115, 22, 0.3); /* Orange glow */
```

## Component Patterns

### Buttons

```tsx
// Primary CTA - orange accent
<button className="bg-accent hover:bg-accent-dark text-white
  font-semibold px-6 py-3 rounded-lg transition-all
  hover:shadow-glow active:scale-95">
  Get Started
</button>

// Secondary - outlined
<button className="border-2 border-primary text-primary
  hover:bg-primary hover:text-white px-6 py-3 rounded-lg">
  Learn More
</button>

// Ghost - minimal
<button className="text-slate-600 hover:text-primary
  hover:bg-slate-100 px-4 py-2 rounded-md">
  Cancel
</button>
```

### Cards

```tsx
<div className="bg-white/80 backdrop-blur-sm rounded-2xl
  shadow-lg border border-slate-200/50 p-6
  hover:shadow-xl transition-shadow">
  {/* Content */}
</div>
```

### Forms

- Labels above inputs
- Large touch targets (min 44px height)
- Clear focus states with accent color
- Inline validation with icons
- Helper text in slate-500

## Dashboard-Specific

### Data Density

Dashboards can be information-dense:
- Compact spacing (8-12px)
- Smaller text (13-14px)
- Truncation with tooltips
- Collapsible sections

### Kanban Columns

```tsx
<div className="flex gap-4 overflow-x-auto pb-4">
  {columns.map(col => (
    <div key={col.id} className="flex-shrink-0 w-80 bg-slate-50
      rounded-xl p-4 max-h-[calc(100vh-200px)] overflow-y-auto">
      <h3 className="font-semibold text-slate-900 mb-3">{col.name}</h3>
      {/* Cards */}
    </div>
  ))}
</div>
```

### Status Indicators

```tsx
// Lead temperature
const temps = {
  hot: 'bg-red-100 text-red-700 border-red-200',
  warm: 'bg-amber-100 text-amber-700 border-amber-200',
  cool: 'bg-blue-100 text-blue-700 border-blue-200'
};
```

## Accessibility

- Color contrast >= 4.5:1
- Touch targets >= 44x44px
- Focus visible (2px accent ring)
- Keyboard navigable
- Screen reader labels
- Reduced motion support

## Tailwind Config

```js
// tailwind.config.js additions
theme: {
  extend: {
    fontFamily: {
      heading: ['Outfit', 'DM Sans', 'sans-serif'],
      body: ['Satoshi', 'sans-serif'],
    },
    colors: {
      primary: '#0F172A',
      accent: '#F97316',
    },
  },
},
```
