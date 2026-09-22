# Gist — Replit Agent Build Instructions

## What You're Building

**Gist** is a web app that creates shared context surfaces. The atomic unit is a "Gist" — a Markdown document with structured primitives (Decisions, Threads, Timeline) that serves as a canonical collaboration artifact. Authors create Gists and share links. Collaborators open links and get caught up in 90 seconds via AI-generated synthesis — no account required.

**Read these companion documents before writing any code:**
1. `prd.md` — Full product requirements, user scenarios, acceptance criteria
2. `design-system.md` — Visual identity, color tokens, typography, components, responsive strategy
3. `pre-prd-definitions.md` — Golden path, data model schema, permissions model, AI architecture

These three documents are authoritative. If these instructions conflict with the PRD, the PRD wins.

---

## Tech Stack

This project follows the same architecture as DropLeaf (an existing Replit project by the same author). Use these exact technologies:

| Layer | Technology | Version |
|-------|-----------|---------|
| **Runtime** | Node.js | 20.x |
| **Backend** | Express.js | 5.x |
| **Frontend** | React | 18.x |
| **Bundler** | Vite | 7.x |
| **Language** | TypeScript | 5.x (strict) |
| **Database** | PostgreSQL | 16 (Replit module) |
| **ORM** | Drizzle ORM | Latest |
| **Validation** | Zod + drizzle-zod | Latest |
| **Styling** | Tailwind CSS | 3.x |
| **UI Components** | shadcn/ui (Radix primitives) | Latest |
| **Data Fetching** | TanStack React Query | 5.x |
| **Client Routing** | Wouter | Latest |
| **Email (outbound)** | Resend | Latest |
| **Markdown** | marked.js + DOMPurify | Latest |
| **Editor** | CodeMirror 6 (@codemirror/lang-markdown) | Latest |
| **Icons** | Lucide React | Latest |
| **Fonts** | Inter + JetBrains Mono | Self-hosted (local files, no CDN) |
| **AI** | OpenRouter API (via fetch) | REST API |

**Do NOT use:** Next.js, Remix, Prisma, Mongoose, Firebase, Supabase, Auth0, Clerk, Tiptap, ProseMirror, Monaco Editor, or any auth service. Authentication is email OTP — built from scratch following the patterns below.

---

## Project Structure

```
gist/
├── .replit
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── drizzle.config.ts
├── components.json                # shadcn/ui config
│
├── shared/
│   └── schema.ts                  # Drizzle tables + Zod validators
│
├── server/
│   ├── index.ts                   # Express app setup, middleware, port binding
│   ├── routes.ts                  # All API endpoints
│   ├── storage.ts                 # DatabaseStorage class (all DB operations)
│   ├── db.ts                      # Drizzle client initialization
│   ├── email.ts                   # OTP email sending via Resend
│   ├── ai.ts                      # OpenRouter API integration
│   ├── email-ingestion.ts         # Inbound email parsing + thread creation
│   ├── static.ts                  # Production static file serving
│   └── vite.ts                    # Dev Vite integration
│
├── client/
│   └── src/
│       ├── main.tsx               # React entry point
│       ├── App.tsx                # Route definitions (Wouter)
│       ├── index.css              # Tailwind + custom properties (design tokens)
│       │
│       ├── pages/
│       │   ├── landing.tsx        # Marketing/home page
│       │   ├── editor.tsx         # Gist creation + editing (author)
│       │   ├── viewer.tsx         # Gist reading + synthesis (collaborator)
│       │   ├── dashboard.tsx      # Author's Gist list
│       │   ├── auth.tsx           # Login/signup (email OTP)
│       │   ├── settings.tsx       # OpenRouter key, account settings
│       │   └── not-found.tsx
│       │
│       ├── components/
│       │   ├── synthesis-panel.tsx    # AI synthesis view (the "front door")
│       │   ├── primitive-decision.tsx # Decision block renderer
│       │   ├── primitive-thread.tsx   # Thread block renderer
│       │   ├── primitive-timeline.tsx # Timeline block renderer
│       │   ├── primitive-block.tsx    # Shared primitive wrapper (left border, label, collapse)
│       │   ├── markdown-renderer.tsx  # Parses .md → design system components
│       │   ├── gist-editor.tsx       # CodeMirror 6 editor + live preview (split pane)
│       │   ├── editor-toolbar.tsx    # "Add Decision" / "Add Thread" / "Add Timeline" buttons
│       │   ├── contributor-badge.tsx
│       │   ├── meta-line.tsx
│       │   ├── share-link.tsx
│       │   ├── otp-gate.tsx          # Email OTP verification flow
│       │   └── gist-card.tsx         # Dashboard list item
│       │
│       ├── hooks/
│       │   ├── use-auth.ts           # Author session management
│       │   ├── use-gist.ts           # Gist data fetching
│       │   └── use-mobile.ts
│       │
│       ├── lib/
│       │   ├── query-client.ts       # React Query config + API wrapper
│       │   ├── primitives.ts         # Primitive parser (blockquote conventions → typed objects)
│       │   ├── tokens.ts             # Design token CSS custom properties
│       │   └── utils.ts
│       │
│       └── ui/                       # shadcn/ui components (auto-generated)
│
├── migrations/                       # Drizzle migrations
│
└── script/
    └── build.ts                      # Production build script
```

---

## Database Schema

Implement these tables in `shared/schema.ts` using Drizzle ORM:

### Tables

**gists**
- `id` — UUID, primary key, default random
- `slug` — varchar(16), unique, not null — 10-character nanoid
- `authorId` — UUID, foreign key → authors.id
- `title` — text, not null
- `markdownSource` — text, not null — the canonical .md content
- `renderedHtml` — text — parsed HTML (for quick rendering)
- `accessTier` — enum('open', 'verified', 'restricted'), default 'open'
- `allowList` — text[] — email/domain allow-list for restricted tier
- `emailIngestionAddress` — varchar(255), unique, nullable — e.g., project-alpha@gist.works
- `isActive` — boolean, default true — soft delete flag
- `createdAt` — timestamp, default now
- `updatedAt` — timestamp, default now
- `deletedAt` — timestamp, nullable

**authors**
- `id` — UUID, primary key
- `email` — varchar(255), unique, not null
- `displayName` — varchar(255), nullable
- `sessionToken` — varchar(64) — 32-byte hex
- `openrouterKey` — text, nullable — encrypted at rest
- `tokenBalance` — integer, default 20 — bundled free synthesis calls
- `plan` — enum('free', 'paid'), default 'free'
- `gistLimit` — integer, default 1
- `createdAt` — timestamp, default now

**contributors**
- `id` — UUID, primary key
- `gistId` — UUID, foreign key → gists.id
- `email` — varchar(255), not null
- `displayName` — varchar(255), not null
- `sessionToken` — varchar(64) — 32-byte hex
- `sessionExpiresAt` — timestamp — 24h from verification
- `createdAt` — timestamp, default now

**threads**
- `id` — UUID, primary key
- `gistId` — UUID, foreign key → gists.id
- `source` — enum('native', 'email'), not null
- `sourceLabel` — varchar(255), nullable — e.g., "Slack #project-alpha" or "Email · project thread"
- `sourceDate` — timestamp, nullable
- `messages` — jsonb, not null — array of {authorName, authorEmail, body, timestamp}
- `summary` — text, nullable — AI-distilled summary
- `messageCount` — integer
- `participantCount` — integer
- `createdAt` — timestamp, default now

**otps**
- `id` — UUID, primary key
- `email` — varchar(255), not null
- `code` — varchar(6), not null — 6-digit code
- `purpose` — enum('author_auth', 'contributor_auth'), not null
- `gistId` — UUID, nullable — null for author auth, set for contributor auth
- `attempts` — integer, default 0
- `used` — boolean, default false
- `expiresAt` — timestamp — 10 minutes from creation
- `createdAt` — timestamp, default now

**timeline_entries**
- `id` — UUID, primary key
- `gistId` — UUID, foreign key → gists.id
- `entryDate` — timestamp, not null
- `description` — text, not null
- `entryType` — enum('auto', 'manual'), not null
- `sourceType` — varchar(50), nullable — e.g., 'decision', 'thread', 'edit', 'contributor'
- `createdAt` — timestamp, default now

**email_ingestion_log**
- `id` — UUID, primary key
- `gistId` — UUID, foreign key → gists.id
- `senderEmail` — varchar(255)
- `subject` — text
- `status` — enum('processed', 'discarded', 'failed')
- `reason` — text, nullable — why discarded/failed
- `createdAt` — timestamp, default now

---

## API Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/request-otp` | None | Send OTP to email (author signup/login) |
| POST | `/api/auth/verify-otp` | None | Verify OTP, create/return author session |
| GET | `/api/auth/me` | Author cookie | Get current author info |
| POST | `/api/auth/logout` | Author cookie | Clear session |
| GET | `/api/gists` | Author cookie | List author's Gists |
| POST | `/api/gists` | Author cookie | Create new Gist |
| GET | `/api/g/:slug` | None (open) or contributor cookie (verified/restricted) | Get Gist for viewing |
| PUT | `/api/gists/:slug` | Author cookie | Update Gist content |
| DELETE | `/api/gists/:slug` | Author cookie | Soft-delete Gist |
| POST | `/api/g/:slug/synthesize` | Author cookie or contributor cookie | Generate AI synthesis |
| POST | `/api/g/:slug/verify` | None | Send contributor OTP |
| POST | `/api/g/:slug/verify/confirm` | None | Verify contributor OTP, create session |
| POST | `/api/g/:slug/threads` | Contributor cookie | Add message to native thread |
| POST | `/api/g/:slug/threads/new` | Author cookie | Create new native thread |
| GET | `/api/g/:slug/timeline` | Same as GET gist | Get timeline entries |
| POST | `/api/g/:slug/timeline` | Author cookie | Add manual timeline entry |
| PUT | `/api/gists/:slug/settings` | Author cookie | Update access tier, allow-list, email ingestion |
| GET | `/api/gists/:slug/manage` | Author cookie | Get Gist management data (contributors, email log) |
| PUT | `/api/settings/openrouter` | Author cookie | Save OpenRouter API key |
| GET | `/api/g/:slug/export` | Same as GET gist | Download .md file |
| POST | `/api/inbound-email` | Webhook secret | Email ingestion endpoint (from email service) |

---

## Critical Implementation Details

### 1. The Primitive Parser (`client/src/lib/primitives.ts`)

This is the most important piece of client code. It takes raw Markdown and identifies primitive blocks by their blockquote conventions. The parser must:

1. Parse the YAML frontmatter (title, created, updated, contributors)
2. Identify blockquote blocks that start with `> **Decision:**`, `> **Thread:**`, or `> **Timeline:**`
3. Parse the internal structure of each primitive (options, evidence, conclusion for decisions; messages for threads; entries for timeline)
4. Return a typed AST: `{ frontmatter, body: Array<TextBlock | DecisionBlock | ThreadBlock | TimelineBlock> }`

The `markdown-renderer.tsx` component takes this AST and renders each block using the appropriate design system component (with left borders, labels, collapse/expand, etc.) instead of rendering as plain blockquotes.

**Text between primitives is rendered as standard Markdown** using `marked.js`.

### 2. The Editor (`client/src/components/gist-editor.tsx`)

The author's editing experience is a **CodeMirror 6 editor with a live preview panel** — the Obsidian pattern.

**Layout:** Split pane. Left: CodeMirror editor with Markdown syntax highlighting. Right: live-rendered Gist with full design system styling (left borders, primitive colors, collapsible blocks). The preview updates as the author types.

**CodeMirror setup:**
- Use `@codemirror/lang-markdown` for Markdown syntax highlighting
- Use `@codemirror/view` with a custom theme that matches our design tokens (Inter font, warm canvas background, accent-colored syntax tokens)
- Add custom syntax highlighting so primitive blockquote patterns (`> **Decision:**`, `> **Thread:**`, `> **Timeline:**`) are visually distinct — tinted with their respective primitive colors
- Line wrapping enabled (content writing, not code)
- Minimal chrome — no line numbers by default (can be toggled)

**Toolbar:** Above the editor, a toolbar with structured-input buttons: "Add Decision," "Add Thread," "Add Timeline Entry." Each opens a form/dialog (shadcn Dialog or Sheet) that collects structured data, then inserts the blockquote-convention Markdown at the cursor position. This is how authors add primitives without manually writing the blockquote syntax.

**Preview panel:** Uses the same `markdown-renderer.tsx` and primitive components as the collaborator view. Same rendering engine, same design system. The preview IS the collaborator experience.

**Do NOT build a WYSIWYG/rich-text editor.** The editor is a Markdown text editor with syntax highlighting. The styled output lives in the preview panel. This keeps the implementation simple and the .md source clean.

### 3. AI Synthesis (`server/ai.ts`)

AI synthesis calls OpenRouter's API. The implementation:

```
POST https://openrouter.ai/api/v1/chat/completions
Headers:
  Authorization: Bearer {user's key OR bundled key}
  HTTP-Referer: https://gist.works
  X-Title: Gist
Body:
  model: {user-configurable, default "anthropic/claude-sonnet-4"}
  messages: [system prompt + full .md content]
  stream: true
```

**System prompts by view type:**

- **Executive Summary**: "You are a context synthesis engine. Read the following artifact and generate a concise executive summary. Focus on: current status, key decisions made (and why), open questions, and who's involved. Be direct. No filler. The reader should be caught up in 90 seconds."

- **Full Context**: "Read the following artifact and generate a comprehensive context summary. Include all decisions with rationale, thread discussions with key points, timeline of events, and open items. Organize by relevance, not chronology."

- **Decisions Only**: "Extract all decisions from this artifact. For each: state the question, the conclusion, the rationale, and who decided. List in reverse chronological order."

- **What Changed**: "Compare the current artifact state against the following last-seen timestamp: {timestamp}. Summarize only what changed since then: new decisions, new thread messages, document edits, new contributors."

**Stream the response.** Use Server-Sent Events (SSE) to stream synthesis to the client. The Synthesis Panel shows content progressively as it arrives.

**Token tracking:** Each synthesis call decrements the author's `tokenBalance` by 1. When balance reaches 0 and no BYOK key is set, return a specific error that the client handles with the BYOK prompt.

### 4. Authentication Pattern

Follow DropLeaf's exact pattern. Two types of auth, both cookie-based:

**Author auth:**
- Author enters email → POST `/api/auth/request-otp` → 6-digit OTP sent via Resend
- Author enters code → POST `/api/auth/verify-otp` → server creates/finds author record, generates 32-byte hex session token, sets `gist_author` httpOnly cookie (1-year maxAge, secure in production, sameSite: lax)
- All author endpoints check this cookie against the `authors.sessionToken` field

**Contributor auth (per-Gist):**
- Contributor clicks "Add to Thread" → prompted for email + display name
- POST `/api/g/:slug/verify` → OTP sent
- POST `/api/g/:slug/verify/confirm` → contributor record created with 24h session token, `gist_contributor_{slug}` cookie set
- Contributor endpoints check this cookie against `contributors.sessionToken` + expiry

**OTP rules:** 6-digit code, 10-minute expiry, max 3 attempts per code, max 5 OTPs per email per hour.

### 5. The Markdown Source as Truth

The `gists.markdownSource` field is the canonical representation. When an author adds a Decision via the UI:

1. The structured form data (question, options, evidence, conclusion, rationale, participants, date) is collected
2. It's converted to the blockquote convention format
3. It's inserted into the `markdownSource` at the appropriate position
4. The `renderedHtml` is regenerated from the updated source
5. A timeline entry is auto-created

The .md source is ALWAYS the single source of truth. The database also stores structured data in the `threads` table for native threads, but the .md source is regenerated to include them.

### 6. Email Ingestion

For MVP, use an inbound email parsing service. Options in order of preference for Replit:
1. **Mailgun Inbound Routes** — POST webhook to `/api/inbound-email`
2. **SendGrid Inbound Parse** — same pattern
3. **Cloudflare Email Workers** — if using Cloudflare

The flow:
1. Email arrives at `{slug}@gist.works` (or custom address)
2. Email service parses and POSTs to `/api/inbound-email` with: sender, recipients, subject, body (plain text + HTML), headers (In-Reply-To, References for threading)
3. Server validates the webhook (signature/secret)
4. Server finds the Gist by email address
5. AI distills the email content into key messages + summary
6. A new Thread record is created (source: 'email')
7. The Gist's `markdownSource` is updated to include the new Thread primitive
8. A timeline entry is auto-created

**If email ingestion is too complex for initial build, defer to Should Have.** The product works without it — native threads are the fallback.

---

## Design System Implementation

**Read `design-system.md` in full.** Here's the critical implementation approach:

### Tailwind + shadcn/ui + Design Tokens

The design system is implemented via **Tailwind CSS with custom theme overrides** and **CSS custom properties** for runtime values (dark mode). shadcn/ui provides accessible base components (buttons, dialogs, inputs, toasts, sheets). Primitive components (Decision, Thread, Timeline blocks) are custom-built.

**`tailwind.config.ts`** — Override Tailwind defaults with our design tokens:

```typescript
// Extend Tailwind theme with Gist design tokens
theme: {
  extend: {
    colors: {
      canvas: 'var(--canvas)',
      'canvas-raised': 'var(--canvas-raised)',
      'ink-primary': 'var(--ink-primary)',
      'ink-secondary': 'var(--ink-secondary)',
      'ink-tertiary': 'var(--ink-tertiary)',
      border: 'var(--border)',
      'border-subtle': 'var(--border-subtle)',
      accent: 'var(--accent)',
      'accent-hover': 'var(--accent-hover)',
      'accent-subtle': 'var(--accent-subtle)',
      'primitive-decision': 'var(--primitive-decision)',
      'primitive-thread': 'var(--primitive-thread)',
      'primitive-timeline': 'var(--primitive-timeline)',
      'primitive-snapshot': 'var(--primitive-snapshot)',
    },
    fontFamily: {
      sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      mono: ['JetBrains Mono', 'SF Mono', 'Cascadia Code', 'Fira Code', 'monospace'],
    },
    maxWidth: {
      content: '680px',
      sidebar: '280px',
    },
    borderRadius: {
      interactive: '6px',
      structural: '8px',
    },
  }
}
```

**`client/src/index.css`** — CSS custom properties for runtime theme switching:

```css
:root {
  --canvas: #FAFAF8;
  --canvas-raised: #FFFFFF;
  --ink-primary: #1C1917;
  --ink-secondary: #57534E;
  --ink-tertiary: #78756F;
  --border: #E5E3DF;
  --border-subtle: #F0EEEB;
  --accent: #0D7C66;
  --accent-hover: #0A6B58;
  --accent-subtle: #E8F5F1;
  --primitive-decision: #0D7C66;
  --primitive-thread: #8A8680;
  --primitive-timeline: #C4B5A0;
  --primitive-snapshot: #D4CFC8;
  /* ... all tokens from design-system.md */
}

@media (prefers-color-scheme: dark) {
  :root {
    --canvas: #1C1917;
    --canvas-raised: #292524;
    --ink-primary: #FAF9F7;
    --ink-secondary: #A8A49E;
    --ink-tertiary: #6B6965;
    --border: #3D3935;
    --border-subtle: #2E2B27;
    --accent: #2EAA8E;
    --accent-hover: #3DBFA1;
    --accent-subtle: #1A2F2A;
    --primitive-decision: #2EAA8E;
    --primitive-thread: #6B6965;
    --primitive-timeline: #8A7E6E;
    --primitive-snapshot: #4A453F;
  }
}
```

This two-layer approach gives us: Tailwind utilities for layout/spacing/responsive (`flex`, `gap-4`, `max-w-content`, `md:grid-cols-2`), CSS custom properties for theming (colors swap automatically in dark mode), and shadcn/ui for standard interactive components (styled with our tokens via the shadcn theme config).
```

### Primitive Block Component

Every primitive shares this structure:

```
┌─────────────────────────────────────────┐
│ ▌ LABEL (uppercase, 11px, colored)       │
│ ▌                                        │
│ ▌ Content                                │
│ ▌                                        │
│ ▌ Meta line (12px mono, ink-tertiary)    │
└─────────────────────────────────────────┘
  3px left border in primitive color
  16px padding-left
```

Implement as a shared `PrimitiveBlock` wrapper component with props for `type` (decision | thread | timeline), `label`, `collapsible` (boolean), and `children`. The left border color and label color come from the CSS custom properties.

### Fonts

Download Inter (400, 500, 600) and JetBrains Mono (400, 500) font files. Place in a `/public/fonts/` directory. Load via `@font-face` in CSS with `font-display: swap`. **Do not load from Google Fonts or any CDN.**

### Key Visual Rules

- Content max-width: 680px
- No pure white (#FFFFFF) backgrounds in light mode — use `--canvas` (#FAFAF8)
- No pure black (#000000) in dark mode — use `--canvas` (#1C1917)
- Accent color (#0D7C66) = interactive only. If it's teal, it must be clickable.
- Motion: 100ms micro, 150ms layout. `ease-out`. No bounce, spring, or overshoot.
- No skeleton screens, spinners, or shimmer. Content areas appear at full height; text populates in.
- Min touch target: 44px × 44px

---

## Build Order

Build in this sequence. Each milestone is independently deployable and testable.

### Milestone 1: Foundation
- Project scaffolding (Express + React + Vite + Drizzle + PostgreSQL)
- Database schema (all tables)
- Author auth (email OTP — signup/login/session)
- Basic Gist CRUD (create, read, update, soft-delete)
- **Test:** Author can sign up, create a Gist with plain Markdown, see it in a dashboard.

### Milestone 2: Design System + Rendering
- CSS custom properties (all tokens, light + dark mode)
- Self-hosted fonts (Inter + JetBrains Mono)
- Primitive parser (blockquote conventions → typed AST)
- Markdown renderer (AST → design system components)
- Primitive block component (shared wrapper with left borders)
- Decision, Thread, Timeline primitive components
- Responsive layout (3 breakpoints per design-system.md)
- **Test:** A Gist with hand-written primitives in .md renders with full design system styling — left borders, correct colors, collapsible, responsive. Looks correct in dark mode.

### Milestone 3: Structured Primitive Editing
- "Add Decision" form (question, options, evidence, conclusion, rationale, date, participants)
- "Add Thread" / "Start Thread" for author
- Manual timeline entry form
- Auto-timeline generation (decision added → timeline entry, thread created → timeline entry, etc.)
- All edits write back to `markdownSource`
- **Test:** Author creates a Gist, adds a Decision via the form, starts a Thread, sees auto-generated Timeline entries. Exports .md — it's valid Markdown with correct blockquote conventions.

### Milestone 4: AI Synthesis
- OpenRouter integration (`server/ai.ts`)
- BYOK key storage (encrypted at rest) + settings page
- Bundled token balance (20 calls)
- Synthesis Panel component
- View type selector (Executive Summary, Full Context, Decisions Only, What Changed)
- SSE streaming from server to client
- Graceful degradation (AI failure → Gist still readable)
- **Test:** Author clicks "Synthesize" — streaming summary appears in Synthesis Panel. Switching view types works. When tokens run out, BYOK prompt appears. When API fails, error message shows but Gist content is unaffected.

### Milestone 5: Sharing + Collaborator Experience
- Link sharing (unique URL per Gist: `/g/{slug}`)
- Zero-identity-tax viewing (no gate for open Gists)
- Synthesis Panel as collaborator entry point (first thing visible)
- Contributor OTP auth (email + display name, per-Gist, 24h session)
- Contributor can add messages to native threads
- Restricted access tier (allow-list)
- Share link copy button with "Copied" confirmation
- **Test:** Author shares a link. Collaborator opens it — sees synthesis first, full Gist below. Collaborator verifies via OTP and adds a thread message. Their name appears. Restricted Gist blocks unauthorized emails.

### Milestone 6: Email Ingestion (Should Have)
- Inbound email webhook endpoint
- Email parsing (sender, body, thread headers)
- AI thread distillation
- Thread primitive creation from email
- Email ingestion settings (enable/disable, custom address)
- Discarded email log
- **Test:** CC the Gist email address on a thread. Email appears as a Thread primitive in the Gist within 60 seconds.

### Milestone 7: Business Model + Polish
- Free tier enforcement (1 Gist limit)
- Upgrade prompt when limit hit
- Error states (all from PRD section 6.4)
- Edge cases (all from PRD section 6.5)
- .md export with correct blockquote conventions
- Performance optimization (page load <1.5s, synthesis first token <5s)
- **Test:** Full golden path works end-to-end. Export → open in VS Code → all primitives readable.

---

## Environment Variables

```
DATABASE_URL=           # PostgreSQL connection string (Replit provides)
PORT=5000               # Standard Replit port
RESEND_API_KEY=         # For OTP email delivery
BUNDLED_OPENROUTER_KEY= # For free-tier synthesis calls
EMAIL_WEBHOOK_SECRET=   # For inbound email verification
CANONICAL_DOMAIN=       # gist.works (production only)
NODE_ENV=               # development | production
OPENROUTER_ENCRYPTION_KEY= # For encrypting stored user API keys
```

---

## What NOT To Do

1. **Do not add a user registration form with passwords.** Auth is email OTP only. No passwords anywhere in the system.
2. **Do not use a CSS framework's default theme.** All colors, typography, and spacing come from `design-system.md`. Override Tailwind defaults with the design tokens.
3. **Do not render primitives as plain blockquotes.** The whole point is that `> **Decision:**` blocks render as styled components with left borders, labels, and collapse/expand. If they look like blockquotes, the design system isn't implemented.
4. **Do not put the full Markdown editor as the collaborator's first screen.** The Synthesis Panel is the entry point. Collaborators see the AI summary first, full Gist below.
5. **Do not store AI-generated synthesis in the database.** Synthesis is computed on-demand via OpenRouter. It's always fresh.
6. **Do not build real-time co-editing (CRDTs, WebSockets for sync).** MVP is single-author editing + async contributions via threads. No simultaneous editing.
7. **Do not add a manual dark mode toggle.** Dark mode follows OS preference via `prefers-color-scheme`. No toggle in V1.
8. **Do not use spinners, skeleton screens, or shimmer loading states.** Content areas appear immediately at full height. Content populates progressively. See design-system.md Motion section.
9. **Do not load fonts from Google Fonts or any external CDN.** Self-host Inter and JetBrains Mono.
10. **Do not block Gist content when AI fails.** AI synthesis is additive. If OpenRouter is down or the key is invalid, the Gist renders normally — only the Synthesis Panel shows an error.

---

## .replit Configuration

```
modules = ["nodejs-20", "web", "postgresql-16"]

[nix]
channel = "stable-24_05"

[deployment]
run = ["sh", "-c", "node ./dist/index.cjs"]
deploymentTarget = "cloudrun"

[[ports]]
localPort = 5000
externalPort = 80

[workflows]
runButton = "Project"

[[workflows.workflow]]
name = "Project"
mode = "parallel"
author = "agent"

[[workflows.workflow.tasks]]
task = "workflow.run"
[workflows.workflow.tasks.args]
name = "Start application"

[[workflows.workflow]]
name = "Start application"
author = "agent"

[workflows.workflow.metadata]
agentRequireRestartOnSave = false

[[workflows.workflow.tasks]]
task = "shell.exec"
[workflows.workflow.tasks.args]
command = "npm run dev"
waitForPort = 5000
```

---

## Success Criteria

The build is done when:

1. An author can sign up (email OTP), create a Gist, add Decisions and Threads via structured forms, see auto-generated Timeline, invoke AI synthesis, and share a link.

2. A collaborator can open that link with zero friction, see the AI synthesis as their first experience, browse the full Gist with styled primitives (left borders, correct colors, collapsible), verify via OTP, and contribute to a thread.

3. The exported .md file is readable in VS Code / Obsidian / GitHub with all primitives visible as blockquotes.

4. Light and dark mode both work correctly via OS preference.

5. The app is responsive at mobile, tablet, and desktop breakpoints.

6. AI failure doesn't break anything — the Gist is always accessible.

---

*This document accompanies `prd.md` and `design-system.md`. All three should be provided to the Replit Agent together.*
