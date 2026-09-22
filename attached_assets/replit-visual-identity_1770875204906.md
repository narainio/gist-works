# Gist — Visual Identity Implementation

**For:** Replit Agent
**Date:** 2026-02-12
**Companion to:** `design-system.md`, `replit-build-instructions.md`, `gist-build-gap-analysis.md`

This document specifies exactly how to implement the Gist visual identity in the existing codebase. Every change is referenced to a file path. No ambiguity — follow literally.

---

## 1. Brand Assets

The canonical brand assets are in `brand-assets/`. Copy the following files into the project's public directory.

### Files to add

```
client/public/
├── favicon.ico                    ← from brand-assets/ico/favicon.ico
├── favicon.svg                    ← from brand-assets/svg/gist-favicon-light.svg
├── apple-touch-icon.png           ← from brand-assets/png/apple-touch-icon.png
├── android-chrome-192.png         ← from brand-assets/png/android-chrome-192.png
├── android-chrome-512.png         ← from brand-assets/png/android-chrome-512.png
├── gist-mark-light.svg            ← from brand-assets/svg/gist-mark-light.svg
├── gist-mark-dark.svg             ← from brand-assets/svg/gist-mark-dark.svg
├── gist-lockup-light.svg          ← from brand-assets/svg/gist-lockup-light.svg
├── gist-lockup-dark.svg           ← from brand-assets/svg/gist-lockup-dark.svg
└── site.webmanifest               ← create (see below)
```

### site.webmanifest

Create `client/public/site.webmanifest`:

```json
{
  "name": "Gist",
  "short_name": "Gist",
  "icons": [
    { "src": "/android-chrome-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/android-chrome-512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "theme_color": "#0D7C66",
  "background_color": "#FAFAF8",
  "display": "standalone"
}
```

### HTML head updates

In `client/index.html`, add inside `<head>`:

```html
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#0D7C66">
```

### Navigation logo

Replace the current document icon + "Gist" text in the navigation bar with the brand mark SVG. Use the inline SVG (not an `<img>` tag) so it respects CSS color variables for dark mode.

The mark SVG source (embed directly in a React component):

```tsx
// components/gist-logo.tsx
export function GistLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="5" height="52" rx="2.5" fill="var(--gist-accent)" />
      <rect x="9" y="2" width="43" height="12" rx="3" fill="var(--gist-border)" />
      <rect x="9" y="20" width="35" height="12" rx="3" fill="var(--gist-border)" />
      <rect x="9" y="38" width="27" height="12" rx="3" fill="var(--gist-border)" />
    </svg>
  );
}
```

Use `<GistLogo size={24} />` in the nav bar next to the "gist" wordmark text. The SVG uses CSS variables so it adapts to light/dark mode automatically.

### OG meta tags

Add to `client/index.html` for link preview cards:

```html
<meta property="og:site_name" content="Gist">
<meta property="og:type" content="website">
<meta property="og:image" content="/gist-lockup-light.svg">
<meta name="twitter:card" content="summary">
```

For individual gist pages, set dynamic OG tags server-side in `server/routes.ts` when serving `/g/:slug` (title, description from gist content).

---

## 2. Typography

### Self-host fonts

Download Inter (weights 400, 500, 600) and JetBrains Mono (weights 400, 500) as WOFF2 files. Place them in `client/public/fonts/`:

```
client/public/fonts/
├── inter-latin-400.woff2
├── inter-latin-500.woff2
├── inter-latin-600.woff2
├── jetbrains-mono-latin-400.woff2
└── jetbrains-mono-latin-500.woff2
```

### @font-face declarations

Add to the top of `client/src/index.css`, BEFORE `@tailwind base`:

```css
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/inter-latin-400.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url('/fonts/inter-latin-500.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url('/fonts/inter-latin-600.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

@font-face {
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/jetbrains-mono-latin-400.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

@font-face {
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url('/fonts/jetbrains-mono-latin-500.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
```

Do NOT use Google Fonts CDN. Do NOT use `@import url(...)` for fonts.

### Type scale

Apply these styles globally. The existing `--font-sans` and `--font-mono` CSS variables are already correct. Add the type scale as utility classes in `index.css` under `@layer utilities`:

```css
.type-h1 {
  font-size: 28px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.02em;
  color: var(--ink-primary);
}

.type-h2 {
  font-size: 22px;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: -0.01em;
  color: var(--ink-primary);
}

.type-h3 {
  font-size: 18px;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: -0.01em;
  color: var(--ink-primary);
}

.type-body {
  font-size: 15px;
  font-weight: 400;
  line-height: 1.65;
  letter-spacing: 0;
  color: var(--ink-secondary);
}

.type-small {
  font-size: 13px;
  font-weight: 400;
  line-height: 1.5;
  color: var(--ink-tertiary);
}

.type-meta {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--ink-tertiary);
}

.type-meta-emphasis {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.5;
  color: var(--ink-tertiary);
}
```

The existing `.primitive-label` utility in `index.css` is already correct (11px, 600, 0.05em, uppercase). Keep it.

---

## 3. Dark Mode

### The problem

The Tailwind config sets `darkMode: ["class"]` (class-based), but `index.css` uses `@media (prefers-color-scheme: dark)` (OS-preference-based). The design system says: "Automatic (OS preference) with no manual toggle in V1."

### The fix

Change `tailwind.config.ts` line:

```typescript
// CHANGE THIS:
darkMode: ["class"],
// TO THIS:
darkMode: "media",
```

The existing `@media (prefers-color-scheme: dark)` block in `index.css` already has all the correct dark mode token overrides. The custom Gist CSS variables (`--canvas`, `--ink-primary`, etc.) are already correctly defined for both light and dark. No other CSS changes needed — the dark mode tokens are already there and correct.

### Verify dark mode works

After the Tailwind config change, all components using CSS variables (`var(--canvas)`, `var(--ink-primary)`, etc.) will automatically respond to OS dark mode preference. Components using Tailwind color classes (`bg-background`, `text-foreground`, etc.) will also respond because those map to HSL variables that have dark mode overrides in the `@media` block.

No `ThemeProvider` component needed. No `next-themes` wiring needed. Just the Tailwind config change.

---

## 4. Primitive Block Styling

### Exact spec for all primitive blocks

Every primitive block (Decision, Thread, Timeline) MUST use this shared structure:

```css
.primitive-block {
  border-left: 3px solid; /* color set per type */
  padding-left: 16px;
  padding-top: 12px;
  padding-bottom: 12px;
  margin-bottom: 24px; /* space-lg */
  background: transparent;
}

.primitive-block .primitive-label {
  /* Already defined in index.css — 11px, 600, uppercase, 0.05em letter-spacing */
  margin-bottom: 8px;
}
```

### Per-type border colors

| Type | CSS variable | Tailwind class |
|------|-------------|----------------|
| Decision | `var(--primitive-decision)` | `border-l-primitive-decision` |
| Thread | `var(--primitive-thread)` | `border-l-primitive-thread` |
| Timeline | `var(--primitive-timeline)` | `border-l-primitive-timeline` |

### Implementation in components

For each primitive component (`primitive-decision.tsx`, `primitive-thread.tsx`, `primitive-timeline.tsx`), the outermost container should use:

```tsx
<div
  className="border-l-[3px] pl-4 py-3 mb-6"
  style={{ borderLeftColor: 'var(--primitive-decision)' }} // or thread/timeline
>
  <span className="primitive-label" style={{ color: 'var(--primitive-decision)' }}>
    DECISION
  </span>
  {/* content */}
</div>
```

### Label colors

- Decision label: `var(--primitive-decision)` — same as accent, highest signal
- Thread label: `var(--primitive-thread)` — neutral, conversational
- Timeline label: `var(--primitive-timeline)` — warm sand, historical

### Meta lines inside primitives

Use monospace font for dates, participant counts, message counts:

```tsx
<span className="type-meta">
  2026-02-12 · Narain, Claude
</span>
```

---

## 5. Shadows

### Replace Tailwind default shadows

The current `index.css` has elaborate shadow definitions using HSL. Replace the shadow custom properties in `:root` with the design system's warm-ink shadows:

Add these to the `:root` block in `index.css` (these are simpler and match the design system exactly):

```css
--shadow-subtle: 0 1px 2px rgba(28, 25, 23, 0.04);
--shadow-medium: 0 2px 8px rgba(28, 25, 23, 0.08);
--shadow-prominent: 0 4px 16px rgba(28, 25, 23, 0.12);
```

In the dark mode `@media` block, shadows should be replaced by subtle border emphasis:

```css
--shadow-subtle: none;
--shadow-medium: none;
--shadow-prominent: none;
```

Use these in components:

```tsx
<div style={{ boxShadow: 'var(--shadow-subtle)' }}>  {/* resting cards */}
<div style={{ boxShadow: 'var(--shadow-medium)' }}>   {/* hovered cards, dropdowns */}
<div style={{ boxShadow: 'var(--shadow-prominent)' }}> {/* modals, popovers */}
```

Or add to Tailwind config:

```typescript
boxShadow: {
  subtle: 'var(--shadow-subtle)',
  medium: 'var(--shadow-medium)',
  prominent: 'var(--shadow-prominent)',
},
```

---

## 6. Content Width

### The rule

All reading content must be constrained to max 680px width.

### Where to apply

The `content-width` utility class already exists in `index.css` (`max-width: 680px`). Apply it to:

1. **Viewer page** — the main content column wrapping rendered markdown + primitives
2. **Editor preview pane** — the right-side preview panel content
3. **Synthesis Panel** — the inner content of the synthesis output
4. **Landing page** — body text sections

```tsx
<div className="content-width mx-auto">
  {/* reading content */}
</div>
```

Do NOT apply to the editor code pane (left side) — CodeMirror needs full width.

---

## 7. Spacing System

### Map Tailwind spacing to design tokens

The design system uses a 4px base unit. Tailwind's default spacing already uses 4px increments (`1 = 4px`, `2 = 8px`, etc.), so the mapping is:

| Design Token | Tailwind Class |
|-------------|---------------|
| `space-xs` (4px) | `p-1`, `gap-1`, `m-1` |
| `space-sm` (8px) | `p-2`, `gap-2`, `m-2` |
| `space-md` (16px) | `p-4`, `gap-4`, `m-4` |
| `space-lg` (24px) | `p-6`, `gap-6`, `m-6` |
| `space-xl` (32px) | `p-8`, `gap-8`, `m-8` |
| `space-2xl` (48px) | `p-12`, `gap-12`, `m-12` |
| `space-3xl` (64px) | `p-16`, `gap-16`, `m-16` |

No config changes needed — just use these Tailwind classes consistently across components. Key placements:

- **Between primitive blocks:** `mb-6` (24px, space-lg)
- **Card internal padding:** `p-4` (16px, space-md)
- **Section gaps within a card:** `space-y-6` (24px)
- **Card-to-card spacing:** `space-y-8` (32px, space-xl)
- **Page-level sections:** `space-y-12` (48px, space-2xl)

---

## 8. Border Radius

The Tailwind config already defines `interactive: 6px` and `structural: 8px`. Use them:

- **Buttons, inputs, tags, badges:** `rounded-interactive`
- **Cards, panels, modals, containers:** `rounded-structural`
- **Pill shapes (status badges):** `rounded-full`

---

## 9. Motion & Loading States

### Rules (from design-system.md)

- NO spinners. NO skeleton screens. NO shimmer.
- Content area shows immediately at full height with `canvas` background.
- Content populates without layout shift.
- Collapse/expand at 150ms ease-out is the primary animation.
- Button presses respond in <100ms.
- Copy confirmation: "Copied" appears for 100ms then reverts.

### Audit checklist

Search the codebase for these and remove/replace:

1. Any `<Spinner>` or loading spinner components
2. Any skeleton/shimmer loading states
3. Any `animate-spin` or `animate-pulse` on loading indicators
4. Any layout shift during content loading

Replace with: empty `canvas`-colored container at full height, content fades in at 150ms.

### Accordion animation

The existing accordion keyframes in `tailwind.config.ts` are already correct (150ms ease-out). Keep them.

---

## 10. Responsive Breakpoints

### From design-system.md

| Breakpoint | Width | Key Adaptations |
|------------|-------|-----------------|
| Mobile | < 640px | Single column. Full-width primitives. No sidebar. Reduced margins (space-lg). |
| Tablet | 640–1024px | Content centered at reading width. Sidebar collapses to overlay. |
| Desktop | > 1024px | Content column max 680px + optional sidebar 280px. |

### Critical: Editor mobile layout

The 50/50 split editor is unusable on mobile. On screens < 640px:

```tsx
// In editor.tsx
const isMobile = useIsMobile(); // already exists as use-mobile.tsx hook

// Instead of side-by-side:
{isMobile ? (
  <div className="flex flex-col h-full">
    <div className="flex border-b border-gist-border">
      <button onClick={() => setView('edit')} className={view === 'edit' ? 'active' : ''}>Edit</button>
      <button onClick={() => setView('preview')} className={view === 'preview' ? 'active' : ''}>Preview</button>
    </div>
    {view === 'edit' ? <GistEditor ... /> : <MarkdownRenderer ... />}
  </div>
) : (
  /* existing 50/50 split */
)}
```

### Minimum touch target

All interactive elements must be at least 44px × 44px. Check buttons, links, and form inputs.

---

## 11. Synthesis Panel as Front Door

### Current problem

The viewer page shows: Title → Content → Synthesis Panel (below fold).

### Required layout

The viewer page for collaborators should show:

```
┌─────────────────────────────────────────┐
│ Nav: [← Back]  [gist logo]  [Export .md]│
├─────────────────────────────────────────┤
│ Title: "Project Alpha — Q1 Context"     │
│ Meta: Updated 2 hours ago · 3 contrib.  │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ ✦ Synthesis                    [↻]  │ │
│ │ ───────────────────────────────────  │ │
│ │ [Exec Summary] [Full] [Decisions]   │ │
│ │                                     │ │
│ │ AI-generated summary content...     │ │
│ │                                     │ │
│ │ Synthesized 2026-02-12 14:30 (mono) │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ Full gist content with primitives...    │
│ (scrollable, below the fold)            │
└─────────────────────────────────────────┘
```

The Synthesis Panel gets:
- `canvas-raised` background
- 2px top border in `accent-subtle` color
- `rounded-structural` corners
- `shadow-subtle` elevation
- "Synthesized [timestamp]" in `type-meta` (monospace)
- Full width within the `content-width` container

---

## 12. Summary of File Changes

| File | Change |
|------|--------|
| `client/index.html` | Add favicon, apple-touch-icon, manifest, OG meta tags |
| `client/src/index.css` | Add @font-face declarations. Add type scale utilities. Add shadow tokens. |
| `tailwind.config.ts` | Change `darkMode: ["class"]` to `darkMode: "media"`. Add shadow utilities. |
| `client/src/components/gist-logo.tsx` | Create new file with inline SVG brand mark component |
| `client/src/pages/viewer.tsx` | Restructure: Synthesis Panel above fold. Add `content-width` to content column. |
| `client/src/pages/editor.tsx` | Add mobile responsive toggle (edit/preview). Add `content-width` to preview pane. |
| `client/src/components/primitive-decision.tsx` | Ensure 3px left border, 16px padding-left, DECISION label in correct style |
| `client/src/components/primitive-thread.tsx` | Same structural alignment |
| `client/src/components/primitive-timeline.tsx` | Same structural alignment |
| `client/src/components/synthesis-panel.tsx` | canvas-raised bg, accent-subtle top border, monospace timestamp |
| `client/public/` | Add all brand asset files (favicon, icons, manifest, SVGs) |
| `client/public/fonts/` | Add self-hosted Inter + JetBrains Mono WOFF2 files |

### What NOT to change

- Do NOT change the database schema
- Do NOT change API routes
- Do NOT change the primitive parsing logic in `lib/primitives.ts`
- Do NOT change authentication flows
- Do NOT add a manual dark mode toggle — OS preference only in V1
- Do NOT use Google Fonts CDN — self-host only
- Do NOT add loading spinners or skeleton screens
