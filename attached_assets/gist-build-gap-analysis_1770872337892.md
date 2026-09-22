# Gist — Build Gap Analysis

**February 12, 2026**

Codebase audit of Gist-Hub MVP against PRD, Design System, and Replit Build Instructions.

---

## Executive Summary

The Gist-Hub MVP has made strong progress. The core architecture is sound: Express + React + Vite + Drizzle + PostgreSQL, CodeMirror editor with live preview, OTP auth, AI synthesis with streaming SSE, and the primitive block parsing/rendering pipeline. The screenshots show a functional product that captures the right shape.

However, several critical flows are incomplete and the visual implementation diverges from the design system in ways that will compound. The most urgent gaps are:

- Thread replies don't work — the core collaboration loop is broken
- Dark mode is non-functional despite CSS variables being defined
- Auto-save is missing — editor requires manual save
- The viewer doesn't lead with synthesis as the collaborator's front door
- Access control has no UI despite backend support

This document catalogs every gap, addition, refinement, and rewrite needed. It is structured to be handed directly to Replit Agent as a phased work order.

**Scorecard:** 14 DONE · 6 PARTIAL · 2 MISSING · 1 NEEDS WORK out of 23 Must-have requirements.

---

## 1. PRD Requirements Scorecard

All 23 Must-have requirements from prd.md cross-referenced against the codebase.

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| M01 | Author can create a new Gist | **DONE** | Working. Dashboard + creation flow functional. |
| M02 | Author can edit Gist .md content | **PARTIAL** | Editor works but no auto-save. Manual save only. Save state indicator missing. |
| M03 | Author can add Decision primitive | **DONE** | Toolbar dialog inserts blockquote. Renders in preview with left-border styling. |
| M04 | Author can add native Thread | **PARTIAL** | Can create threads, but each message creates a NEW thread. No reply-to-existing-thread flow. Contributors can't add to threads from viewer. |
| M05 | Timeline auto-generates | **DONE** | Auto entries created for gist creation, updates, contributor joins, thread starts. |
| M06 | Author can add manual timeline entries | **PARTIAL** | Toolbar dialog exists. But timeline entries are stored in DB only — not inserted into the .md source as blockquote primitives. |
| M07 | AI synthesis generates a view | **DONE** | Streaming SSE works. 4 view types. Uses OpenRouter (Gemini Flash). |
| M08 | Synthesis is collaborator entry point | **NEEDS WORK** | Synthesis panel exists on viewer page but it's not above-the-fold dominant. The viewer shows the gist title first, then synthesis below. PRD says synthesis should be THE first thing a collaborator sees. |
| M09 | View type selector on Synthesis Panel | **DONE** | 4 tabs: Executive Summary, Full Context, Decisions Only, What Changed. |
| M10 | Sharing via link with zero identity tax | **DONE** | Open access tier works. Anyone with link can view. |
| M11 | Contributor auth via email OTP | **PARTIAL** | OTP flow works but session is 7 days (PRD says 24h). Attempt limit is 5 (PRD says 3). Dev mode shows OTP in UI (correct for testing). |
| M12 | Author auth via email OTP | **DONE** | Email OTP → session cookie (30 days). Working. |
| M13 | Collaborator can contribute to threads | **MISSING** | Critical gap. Contributors cannot reply to existing threads from the viewer. Thread creation from viewer creates a new detached thread. The contribution flow (verify → reply to thread) is not built. |
| M14 | Restricted access tier | **PARTIAL** | Schema has accessTier + allowList fields. Backend enforces access tiers. But NO UI for author to manage access control — no way to set tier or edit the allow-list from the editor. |
| M15 | Design system implementation | **NEEDS WORK** | Using Tailwind + shadcn/ui (correct). CSS variables defined. But significant gaps: primitives don't fully match design-system.md specs (see design section below). Brand mark/favicon not integrated. Typography doesn't match Inter spec. |
| M16 | Responsive design | **NEEDS WORK** | Basic responsiveness via Tailwind. But no evidence of systematic testing at mobile (<640px), tablet (640-1024px), desktop (>1024px) breakpoints per design system. Editor is 50/50 split — unusable on mobile. |
| M17 | Dark mode (OS preference) | **MISSING** | CSS variables are defined for dark mode in index.css but the :root values are all light-mode. No prefers-color-scheme media query. next-themes is installed but no ThemeProvider visible in App.tsx. Dark mode is not functional. |
| M18 | Gist export as .md | **DONE** | Export endpoint works. Client-side Blob download also available from editor. |
| M19 | Graceful degradation of exported .md | **NEEDS WORK** | Export works but need to verify blockquote primitives render correctly in VS Code, Obsidian, GitHub. |
| M20 | BYOK OpenRouter integration | **DONE** | Settings page has key input. Key saved to DB. Synthesis uses user key if available. |
| M21 | Bundled free tokens | **DONE** | 20 tokens allocated on account creation. Decremented per synthesis. Balance shown in dashboard. |
| M22 | Business model: 1 free Gist | **DONE** | Free plan limit enforced (1 active gist). Upgrade prompt shown. Screenshots confirm this works. |
| M23 | AI graceful degradation | **DONE** | If synthesis fails, gist content still renders. Panel shows error message. |

---

## 2. Design System Gaps

Cross-referencing against design-system.md Warm Signal specifications.

| Area | Status | Detail |
|------|--------|--------|
| Brand Assets | **MISSING** | Favicon is a generic document icon. Logo in nav is a document icon + "Gist" text. Our brand mark (spine + 3 bars) and favicon SVGs are not integrated. |
| Color Tokens | **PARTIAL** | CSS variables defined in index.css but values don't match design-system.md. E.g., accent colors, primitive border colors need verification. Dark mode tokens not active. |
| Typography | **NEEDS WORK** | Using system fonts, not Inter/JetBrains Mono. Build instructions say self-host (no CDN). Font files not present. Type scale (sizes, weights, letter-spacing) not calibrated to design system spec. |
| Primitive Blocks | **PARTIAL** | Left-border styling exists but doesn't fully match spec: 3px border, 16px padding-left, uppercase 11px 600-weight label with 0.05em letter-spacing. Decision block renders well; Thread and Timeline need polish. |
| Motion / Loading | **NEEDS WORK** | PRD explicitly says: no spinners, no skeleton screens, no shimmer. Content appears at full height, text populates progressively. Need to audit all loading states. |
| Spacing System | **NEEDS WORK** | Design system defines 4px base unit with named tokens (xs through 3xl). Current implementation uses ad-hoc Tailwind spacing. Should map Tailwind config to design system tokens. |
| Shadows | **NEEDS WORK** | Design system defines 3 shadow levels (subtle, medium, prominent). Current shadows are Tailwind defaults, not the warm-ink shadows specified (rgba(28,25,23,x)). |
| Border Radius | **PARTIAL** | Design system says interactive=6px, structural=8px. Tailwind config has these but usage across components needs audit. |
| Content Width | **NEEDS WORK** | Design system says max 680px for reading. Editor preview and viewer don't enforce this constraint. |

---

## 3. Feature Gaps & Additions

Features missing or needing addition, ordered by priority.

| Feature | Priority | Detail |
|---------|----------|--------|
| Thread replies | **CRITICAL** | The core collaboration flow is broken. Contributors cannot reply to existing threads from the viewer page. Each "thread" is currently a single message. Need: contributor verifies via OTP → sees threads → can add reply to any thread. Replies append to the thread's messages array and get written back to the .md source. |
| Auto-save | **HIGH** | Editor requires manual save. Should debounce auto-save with "Saving… / Saved" status indicator. This was called out in the Replit feedback screenshots. |
| Access control UI | **HIGH** | Author has no way to change access tier or manage the allow-list from the editor/settings. Schema supports it, backend supports it, but there's no UI. The "Anyone with link" label in the editor toolbar hints at it but isn't interactive. |
| Dark mode | **HIGH** | CSS variables exist for dark tokens but no prefers-color-scheme media query is active. ThemeProvider not wired up. All users see light mode regardless of OS setting. |
| Editor mobile UX | **HIGH** | 50/50 split editor is unusable on mobile. Need responsive layout: single-pane with toggle between edit/preview on small screens. |
| Synthesis as front door | **HIGH** | Viewer page should show Synthesis Panel as the dominant above-the-fold element for collaborators. Currently it's secondary to the gist title and content. |
| Enter key for OTP | **MEDIUM** | OTP form only submits on button click, not Enter/Cmd+Enter. Called out in Replit feedback screenshots. |
| Brand integration | **MEDIUM** | Replace generic document icon with our brand mark SVG. Add favicon. Update OG meta tags with brand lockup for link previews. |
| Self-hosted fonts | **MEDIUM** | Inter and JetBrains Mono must be self-hosted (no Google Fonts CDN). Font files need to be added to the project and loaded via @font-face. |
| Timeline in .md source | **MEDIUM** | Timeline entries are stored in DB only. They should also be written as blockquote primitives in the .md source for export fidelity. Currently, exported .md files won't contain auto-generated timeline entries. |
| Rate limiting | **MEDIUM** | No rate limiting on OTP request endpoints. A malicious actor could spam OTP emails. Need per-IP or per-email throttling. |
| Email ingestion | **LOW** | Schema and tables exist. No email server/webhook integration built. This is in-scope for MVP per PRD but could be deferred to post-launch if needed. |

---

## 4. Architectural Rewrites

Structural changes needed — not just additions or fixes.

### Thread data model

Current: each "add thread" creates a new thread row. Need: threads have multiple messages (the JSONB messages array exists but isn't used for replies). Add POST /api/g/:slug/threads/:threadId/reply endpoint. Frontend: render threads as expandable conversations with reply input.

### Markdown source as truth

Timeline entries and thread activity should be reflected in the .md source, not just the DB. When a contributor adds a thread reply or an auto-timeline fires, the .md should be updated. This is a core architectural principle from the PRD: "the .md file is the canonical artifact."

### Viewer page layout

Restructure viewer to lead with Synthesis Panel (full-width, above fold). Below: gist content rendered with primitives. Threads are shown inline. Contributors section at bottom. Current layout buries synthesis.

### OTP session parameters

Contributor session: change from 7 days to 24 hours (PRD spec). OTP attempts: change from 5 to 3 (PRD spec). Small changes but important for security alignment.

---

## 5. What's Working Well

Solid foundations to preserve.

- Core architecture: Express 5 + React 18 + Vite 7 + Drizzle + PostgreSQL. Clean, matches spec.
- Database schema: All 7 tables match PRD. Relations correct. Soft deletes implemented.
- OTP auth: Working for authors and contributors. Dev mode shows code for testing.
- AI synthesis: Streaming SSE, 4 view types, OpenRouter integration, token tracking.
- Primitive parsing: Blockquote-convention parser correctly identifies all block types.
- CodeMirror editor: Split-pane with live preview, syntax highlighting, undo/redo.
- Business model: 1 free Gist limit enforced. Upgrade prompt displayed.
- Timeline auto-generation: Events fire correctly for all tracked actions.
- Export: Both server-side and client-side export paths functional.

---

## 6. Recommended Work Order

Five phases. Each testable independently. Ordered by impact.

### Phase 1: Fix the Collaboration Loop

*The product's core promise is broken without thread replies.*

1. Add POST /api/g/:slug/threads/:threadId/reply — append to JSONB messages array
2. Viewer: show reply input on each thread after contributor OTP verification
3. Thread renderer: display all messages, not just the first
4. Write thread replies back to .md source as blockquote entries
5. OTP form: Enter key submits (keyboard support)
6. Contributor session: 7 days → 24 hours (PRD spec)
7. OTP attempt limit: 5 → 3 (PRD spec)

### Phase 2: Editor Polish

1. Auto-save with debounce + "Saving… / Saved" indicator
2. Access control panel: tier dropdown + allow-list editor
3. Timeline entries written to .md source (not just DB)
4. Responsive editor: single-pane with edit/preview toggle on mobile

### Phase 3: Design System Alignment

1. Self-host Inter + JetBrains Mono. @font-face declarations. No CDN.
2. Dark mode: prefers-color-scheme media query. Map dark tokens from design-system.md.
3. Brand assets: replace icons with brand mark SVG. Add favicon.ico + apple-touch-icon + OG meta.
4. Typography: calibrate to design-system.md type scale.
5. Primitives: 3px border, 16px padding-left, uppercase 11px/600/0.05em labels.
6. Shadows: warm-ink rgba tokens (not Tailwind defaults).
7. Content width: 680px max on viewer + preview pane.

### Phase 4: Viewer Restructure

1. Synthesis Panel as dominant above-the-fold element for collaborators
2. Full-width card with accent-subtle top border, monospace timestamp
3. Gist content rendered below with inline primitives
4. Inline OTP gate on first "Reply" click, then reply inputs show for session

### Phase 5: Hardening

1. Rate limiting on OTP endpoints (per-IP + per-email)
2. Verify exported .md in VS Code, Obsidian, GitHub
3. Responsive audit at mobile / tablet / desktop breakpoints
4. Loading state audit: no spinners or skeletons per design system
5. Email ingestion webhook (if time permits)
