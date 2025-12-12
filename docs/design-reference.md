# DAWA Dashboard — Design Reference (Wavo Style)

Design system and UI conventions based on Wavo, intended as a **style reference** for DAWA Dashboard.  
This defines **how things should look and feel**, not layout or features.

---

## 1. Design Goals

- Neutral, editorial SaaS aesthetic
- Calm, readable dashboards for long sessions
- Strong hierarchy, minimal visual noise
- Components feel solid, not "playful"

---

## 2. Tech Stack

- Next.js App Router
- Tailwind CSS v4
- shadcn/ui (New York style, neutral base)
- Radix primitives
- Geist font family (Vercel)
- CSS variables for theming
- `tw-animate-css` for subtle motion

**Key dependencies:**
```json
{
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "tailwind-merge": "^3.3.1",
  "lucide-react": "^0.552.0",
  "@radix-ui/react-slot": "^1.2.3"
}
```

---

## 3. Typography

**Fonts:** Geist Sans + Geist Mono (via `next/font/google`)

```tsx
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// Applied on <body>:
className={`${geistSans.variable} ${geistMono.variable} antialiased`}
```

| Use | Style |
|-----|-------|
| Headings | `font-semibold` |
| Body | default weight |
| Metadata / captions | `text-sm` or `text-xs` |
| IDs / technical values | `font-mono` |

---

## 4. Color Tokens (Light Mode)

All colors use **oklch** color space:

```css
:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
}
```

**Principles:**
- Background is pure white
- Foreground is near-black
- Muted foreground is medium gray
- Borders are subtle light gray
- No colored accents by default — neutral palette
- No gradients

---

## 5. Radius & Elevation

**Base radius:** `--radius: 0.625rem` (10px)

| Element | Radius |
|---------|--------|
| Cards | `rounded-xl` |
| Inputs & buttons | `rounded-md` |

**Elevation:** `shadow-sm` only. Most separation via borders, not shadows.

---

## 6. Core UI Primitives

### Button

Variants via CVA. Base: `rounded-md text-sm font-medium h-9 px-4`

| Variant | Style |
|---------|-------|
| `default` | `bg-primary text-primary-foreground hover:bg-primary/90` |
| `outline` | `border bg-background shadow-xs hover:bg-accent` |
| `secondary` | `bg-secondary text-secondary-foreground hover:bg-secondary/80` |
| `ghost` | `hover:bg-accent hover:text-accent-foreground` |

Sizes: `sm` (h-8), `default` (h-9), `lg` (h-10), `icon` (size-9)

### Card

```
bg-card text-card-foreground flex flex-col gap-6 
rounded-xl border py-6 shadow-sm
```

- `CardHeader`: `px-6`
- `CardTitle`: `font-semibold leading-none`
- `CardDescription`: `text-muted-foreground text-sm`
- `CardContent`: `px-6`

### Input

```
h-9 w-full rounded-md border border-input bg-transparent 
px-3 py-1 text-base shadow-xs md:text-sm
placeholder:text-muted-foreground
focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]
```

---

## 7. Layout Philosophy

- Pages composed of stacked cards
- Headers are understated
- Sidebars are optional, not dominant
- Empty states are explicit and instructional

**Avoid:** Dense grids, masonry layouts, heavy visual dashboards

---

## 8. Tables & Structured Data

- Small font sizes (`text-xs`, `text-sm`)
- Sticky headers preferred
- Borders define cells, not backgrounds
- No zebra striping

---

## 9. Utils Required

```ts
// lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```
