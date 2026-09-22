# Gist — Shared Context Surfaces

## Overview
Gist is a shared context surface tool for cross-org knowledge workers. Users create canonical collaboration artifacts with Markdown-based primitives: Decisions, Threads, Timelines. AI synthesis provides executive summaries. Zero-identity-tax sharing via link access with email OTP for contributions.

## Architecture
- **Frontend**: React + Vite + TanStack Query + wouter + shadcn/ui + Tailwind CSS
- **Backend**: Express + Drizzle ORM + PostgreSQL (Neon)
- **AI**: OpenRouter API (BYOK) with SSE streaming synthesis
- **Email**: Resend for OTP delivery (dev mode logs codes to console)
- **Auth**: Email OTP with session cookies (httpOnly)

## Design System — Warm Signal
- Canvas: `#FAFAF8` (light) / `#1C1917` (dark)
- Accent: `#0D7C66` (teal)
- Fonts: Inter (UI), JetBrains Mono (metadata/code) — self-hosted WOFF2 in `client/public/fonts/`
- Primitive borders: Decision `#0D7C66`, Thread `#8A8680`, Timeline `#C4B5A0`
- Type scale: type-h1/h2/h3/body/small/meta/meta-emphasis utilities in index.css
- Dark mode: OS preference via `darkMode: "media"` (no manual toggle in V1)
- Shadows: shadow-subtle/medium/prominent CSS vars (none in dark mode)
- Brand mark: GistLogo inline SVG component (`client/src/components/gist-logo.tsx`)
- Content width: 680px max for reading surfaces
- No spinners, skeletons, or shimmer — canvas backgrounds for loading states
- Never pure white or pure black

## Key Files
- `shared/schema.ts` — All Drizzle schemas and types
- `server/storage.ts` — DatabaseStorage class (IStorage interface)
- `server/routes.ts` — All API endpoints
- `client/src/lib/primitives.ts` — Markdown primitive parser/generator
- `client/src/components/` — All UI components
- `client/src/pages/` — Landing, Auth, Dashboard, Editor, Viewer, Settings

## Business Model
- Free tier: 1 Gist, 20 bundled synthesis tokens
- BYOK: Add OpenRouter key for unlimited synthesis
- Hard limits enforced in backend

## Primitives & Block Types
- TextBlock: plain text (always visible, "cover letter" before first ## heading)
- SectionBlock: content under ## headings, collapsible with chevron and preview
- DecisionBlock: blockquote `> **Decision:**`, collapsible with conclusion preview
- ThreadBlock: blockquote `> **Thread:**`, collapsible with latest message preview, `anchorBlockIndex` for inline positioning
- TimelineBlock: blockquote `> **Timeline:**`, collapsible with latest entry preview
- SnapshotBlock: blockquote `> **Snapshot:**` stub, parser + placeholder renderer

## Recent Changes
- 2026-02-13: **v1.1.0** — AI synthesis markdown rendering (marked + DOMPurify + prose-synthesis CSS), collapsible 200px synthesis container with gradient fade, per-view model selection (Flash/Sonnet), structured synthesis prompts, token cost differentiation, reverse-chronological authoring (prependBlock), SectionBlock parser (## heading split), collapsible blocks with preview text, SnapshotBlock stub, thread anchor hover between blocks, anchorBlockIndex on threads schema, optimistic reply compose (always-visible textarea, OTP gates submit), lastVisited localStorage with NEW badges, block deep linking (stable IDs, hash scroll, auto-expand)
- 2026-02-12: **v1.0.0** — Rate limiting on OTP endpoints (express-rate-limit, 5/15min/IP), OTP attempt enforcement (check before code compare), timeline entries appended to markdownSource as blockquote primitives, access control UI (dropdown for open/verified/restricted + allow-list input), skeleton animate-pulse removed, back arrow on viewer for authors
- 2026-02-12: **v0.5.0** — Button border-transparent, landing page polish (unified icon colors, type-body cards, shadow-subtle/hover:shadow-medium, 36px hero), frontmatter abstraction (title bar + relative timestamp, body-only CodeMirror), mobile editor at <640px (edit/preview/threads tabs, "+" toolbar dropdown), OTP params verified (24h/3 attempts/Enter key)
- 2026-02-12: Visual identity update — self-hosted fonts, GistLogo SVG component, type scale utilities, darkMode: "media", shadow tokens, primitive label colors, content-width constraints, mobile editor toggle, synthesis panel styling, brand assets (favicon.ico, apple-touch-icon, webmanifest, OG tags)
- 2026-02-12: Phase 1 thread collaboration — inline thread replies via `/api/g/:slug/threads/:threadId/reply`, per-thread reply UI, OTP Enter key submit, OTP attempt limit reduced to 3, contributor session reduced to 24h, all LSP errors in routes.ts fixed, threads data included in public gist view response
- 2026-02-11: Full MVP build — schema, frontend components, backend API, auth flow, primitive parser, synthesis SSE streaming
