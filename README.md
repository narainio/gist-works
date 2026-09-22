# Gist Works

Gist Works is a shared context surface for teams. It turns decisions, discussions, timelines, and supporting notes into a single, linkable collaboration artifact.

Anyone can read a shared Gist. Contributions are protected with email one-time passwords, so collaborators can participate without a traditional account setup.

## What it does

- Create Markdown-first Gists for projects, decisions, and cross-team context
- Structure content with sections, decisions, threads, timelines, and snapshots
- Share read-only, verified-contributor, or restricted links
- Hold replies in context through anchored discussion threads
- Generate AI synthesis views for executive summaries, decisions, changes, and full context
- Highlight unseen updates and support direct links to individual blocks

## Stack

- **Frontend:** React, Vite, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Express, TypeScript
- **Data:** PostgreSQL with Drizzle ORM
- **AI:** OpenRouter with streaming synthesis
- **Email:** Resend for one-time-password delivery

## Run locally

### Prerequisites

- Node.js 20+
- PostgreSQL database

### Install and configure

```bash
npm install
```

Create a `.env` file with the values needed for your environment:

```bash
DATABASE_URL=postgresql://...
SESSION_SECRET=replace-with-a-long-random-value

# Optional: enables email delivery outside development
RESEND_API_KEY=re_...

# Optional: enables server-side AI synthesis
OPENROUTER_API_KEY=...
```

In development, OTP codes are logged to the server console when `RESEND_API_KEY` is not set.

Apply the database schema and start the app:

```bash
npm run db:push
npm run dev
```

The app runs on `http://localhost:5000` by default.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Build the production bundle |
| `npm run start` | Run the production bundle |
| `npm run check` | Type-check the project |
| `npm run db:push` | Apply the Drizzle schema to the configured database |

## Project layout

```text
client/        React application
server/        Express API, authentication, storage, and Vite integration
shared/        Drizzle schema and shared types
script/        Production build script
attached_assets/  Product references and design assets
```

## Deployment

The included Replit configuration builds the app with `npm run build` and serves `dist/index.cjs`. Configure production secrets through your deployment environment; do not commit `.env` files.