# Gist — Collaborator Screen Work Order

**Date:** 2026-02-13
**Current version:** v0.5.0 (Gist-Works)
**For:** Replit Agent
**Companion docs:** `prd.md`, `design-system.md`, `gist-v100-work-order.md`

---

## Context

This work order addresses the collaborator viewer experience and the rendering/interaction patterns that flow back to the author composer screen. It covers AI synthesis quality, content structure, collapsible blocks, inline threads, and several UX refinements.

This is a **large scope change** touching the synthesis panel, the viewer, the editor, the primitive parser, and the rendering pipeline. Implement phase by phase. Do not skip phases. Test each phase before moving to the next.

---

## What's Working — Preserve These

- Thread replies (POST endpoint, JSONB messages, reply UI)
- Auto-save with 2-second debounce
- Self-hosted fonts (Inter + JetBrains Mono, WOFF2, @font-face)
- Dark mode via `prefers-color-scheme: media`
- Shadow tokens, type scale, primitive labels
- Brand mark (inline SVG GistLogo)
- Content width 680px
- Business model logic (1 free Gist, 20 bundled tokens)
- Export as .md
- Favicon, apple-touch-icon, OG meta

---

## Phase 1: AI Synthesis Overhaul

*The synthesis panel is the front door for every collaborator. It needs to be reliable, well-formatted, and contained.*

### 1.1 Render Synthesis Output as Markdown

**File:** `client/src/components/synthesis-panel.tsx`

The synthesis content is currently rendered as raw text with `whitespace-pre-wrap`. AI output contains markdown formatting (headings, bold, lists) that shows as literal characters.

**Replace the content rendering (around line 178-193):**

```tsx
// Import at top of file
import { marked } from "marked";
import DOMPurify from "dompurify";

// Replace the content div:
{(content || isStreaming) && (
  <div
    ref={contentRef}
    className="prose-synthesis"
    style={{ color: "var(--ink-secondary)" }}
    data-testid="text-synthesis-content"
  >
    {content && (
      <div
        dangerouslySetInnerHTML={{
          __html: DOMPurify.sanitize(marked.parse(content) as string),
        }}
      />
    )}
    {isStreaming && !content && (
      <div style={{ minHeight: "120px" }} />
    )}
    {isStreaming && (
      <span
        className="inline-block w-1.5 h-4 ml-0.5"
        style={{ backgroundColor: "var(--gist-accent)", opacity: 0.7 }}
      />
    )}
  </div>
)}
```

**Add synthesis prose styling to `index.css`:**

```css
.prose-synthesis {
  font-size: 15px;
  line-height: 1.65;
  color: var(--ink-secondary);
}

.prose-synthesis h2 {
  font-size: 16px;
  font-weight: 600;
  color: var(--ink-primary);
  margin-top: 16px;
  margin-bottom: 8px;
}

.prose-synthesis h3 {
  font-size: 15px;
  font-weight: 600;
  color: var(--ink-primary);
  margin-top: 12px;
  margin-bottom: 6px;
}

.prose-synthesis p {
  margin-bottom: 10px;
}

.prose-synthesis ul, .prose-synthesis ol {
  margin-bottom: 10px;
  padding-left: 20px;
}

.prose-synthesis li {
  margin-bottom: 4px;
}

.prose-synthesis strong {
  color: var(--ink-primary);
  font-weight: 600;
}

.prose-synthesis code {
  font-family: var(--font-mono);
  font-size: 13px;
  background-color: var(--border-subtle);
  padding: 1px 4px;
  border-radius: 3px;
}
```

### 1.2 Fixed-Height Synthesis Container with Inline Expand

**Same file: `synthesis-panel.tsx`**

Add a max-height container with gradient fade and "Show more" toggle:

```tsx
const [isExpanded, setIsExpanded] = useState(false);
const [needsExpand, setNeedsExpand] = useState(false);

// After content updates, check if it overflows
useEffect(() => {
  if (contentRef.current) {
    setNeedsExpand(contentRef.current.scrollHeight > 200);
  }
}, [content]);

// Wrap the content area:
<div className="relative">
  <div
    ref={contentRef}
    className="prose-synthesis overflow-hidden transition-[max-height] duration-150 ease-out"
    style={{
      maxHeight: isExpanded ? `${contentRef.current?.scrollHeight || 2000}px` : "200px",
      color: "var(--ink-secondary)",
    }}
  >
    {/* rendered content here */}
  </div>

  {/* Gradient fade when collapsed and content overflows */}
  {needsExpand && !isExpanded && (
    <div
      className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
      style={{
        background: `linear-gradient(transparent, var(--canvas-raised))`,
      }}
    />
  )}

  {/* Show more / Show less toggle */}
  {needsExpand && (
    <button
      onClick={() => setIsExpanded(!isExpanded)}
      className="mt-2 text-[13px] font-medium"
      style={{ color: "var(--gist-accent)" }}
    >
      {isExpanded ? "Show less" : "Show more"}
    </button>
  )}
</div>
```

The 200px max-height fits approximately 8-10 lines of rendered body text. Executive summaries should fit within this. Longer synthesis types (Full Context, Decisions Only) will need the expand.

**When switching view types, reset expansion:**

```tsx
// In the synthesize() callback, add:
setIsExpanded(false);
setNeedsExpand(false);
```

### 1.3 AI Strategy Per Synthesis View Type

**File:** `server/routes.ts` — the synthesis endpoint (lines 501-626)

The current implementation uses one model, one token budget, and minimal prompts. Replace with a per-view-type configuration.

#### 1.3a Model Selection

Replace the hardcoded model with a per-view-type configuration:

```typescript
interface SynthesisConfig {
  model: string;
  max_tokens: number;
  temperature: number;
  prompt: string;
}

const synthesisConfigs: Record<string, SynthesisConfig> = {
  executive: {
    model: "google/gemini-2.0-flash-001",
    max_tokens: 400,
    temperature: 0.3,
    prompt: "" // see 1.3b
  },
  full: {
    model: "anthropic/claude-sonnet-4-20250514",
    max_tokens: 2000,
    temperature: 0.3,
    prompt: ""
  },
  decisions: {
    model: "google/gemini-2.0-flash-001",
    max_tokens: 1500,
    temperature: 0.1,
    prompt: ""
  },
  changed: {
    model: "anthropic/claude-sonnet-4-20250514",
    max_tokens: 600,
    temperature: 0.3,
    prompt: ""
  },
};
```

**Why this split:**

- **Executive Summary** uses Flash because speed to first token is the priority (PRD: < 5 seconds). The prompt does the heavy lifting — Flash is good enough for concise summaries.
- **Full Context** uses Sonnet because the task requires reading the entire Gist, identifying themes, and producing a well-organized comprehensive summary. Quality matters more than speed here. The collaborator explicitly chose "Full Context" — they're willing to wait an extra second.
- **Decisions Only** uses Flash because it's a structured extraction task. The model needs to find decision blockquotes and reformat them, not reason deeply. Flash excels at this.
- **What Changed** uses Sonnet because temporal reasoning (comparing recent entries against the full document to identify what's meaningful) benefits from a stronger model.

**Fallback logic**: If the primary model returns a non-200, retry once with `google/gemini-2.0-flash-001` as fallback. If that also fails, return the graceful degradation message.

```typescript
async function callOpenRouter(
  apiKey: string,
  config: SynthesisConfig,
  systemPrompt: string,
  userContent: string,
  referer: string
): Promise<Response> {
  const makeRequest = async (model: string) => {
    return fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": referer,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        stream: true,
        max_tokens: config.max_tokens,
        temperature: config.temperature,
      }),
    });
  };

  let response = await makeRequest(config.model);

  // Fallback to Flash if primary model fails
  if (!response.ok && config.model !== "google/gemini-2.0-flash-001") {
    log(`Primary model ${config.model} failed (${response.status}), falling back to Flash`, "synthesis");
    response = await makeRequest("google/gemini-2.0-flash-001");
  }

  return response;
}
```

#### 1.3b Prompts Per View Type

Replace the minimal one-liners with structured prompts. These are the FULL system prompts — copy them exactly.

**Executive Summary:**

```typescript
executive: {
  // ...
  prompt: `You synthesize shared context surfaces called "Gists." A Gist is a canonical artifact containing decisions, discussion threads, and timeline entries for a cross-org collaboration.

Your task: write an executive summary for someone who needs to get caught up in 90 seconds.

Rules:
- Write 3 to 5 sentences. No more than 5 sentences. No headers.
- Lead with the single most important current status or decision.
- Mention any open questions or unresolved threads if they exist.
- End with what the reader should know or do next.
- Use **bold** for key decisions or status changes.
- Write in plain language for a senior stakeholder. No jargon.
- Do NOT include a title or "Executive Summary" header — the UI provides that.
- Do NOT use bullet points. Write flowing prose.`
},
```

**Full Context:**

```typescript
full: {
  // ...
  prompt: `You synthesize shared context surfaces called "Gists." A Gist is a canonical artifact containing decisions, discussion threads, and timeline entries for a cross-org collaboration.

Your task: write a comprehensive summary that covers everything in this Gist.

Rules:
- Use markdown formatting: ## headers for major sections, **bold** for emphasis, bullet lists where appropriate.
- Organize by theme or topic, not by document order. Group related decisions and threads together.
- For each decision, state what was decided and the key rationale (1 sentence each).
- For each active thread, summarize the discussion and note if it's resolved or open.
- Include a "## Timeline" section at the end with the 5 most recent events.
- Write for someone who has never seen this Gist before.
- Target 400 to 800 words. Be thorough but not repetitive.
- Do NOT include a title — the UI provides that.`
},
```

**Decisions Only:**

```typescript
decisions: {
  // ...
  prompt: `You extract and summarize decisions from shared context surfaces called "Gists."

Your task: list every decision found in this Gist in a consistent, structured format.

Rules:
- For each decision, output exactly this format:

**[Decision question or title]**
Decided: [date if available, otherwise "Date not recorded"]
Conclusion: [what was decided — 1 sentence]
Rationale: [why — 1 sentence]

- Separate each decision with a blank line.
- Order decisions reverse-chronologically (most recent first). If dates aren't available, maintain document order.
- If no decisions exist, write: "No decisions have been recorded in this Gist yet."
- Do NOT add commentary, introductions, or conclusions. Just the decisions.
- Do NOT use bullet points within each decision block.`
},
```

**What Changed:**

```typescript
changed: {
  // ...
  prompt: `You synthesize shared context surfaces called "Gists." A Gist is a canonical artifact containing decisions, discussion threads, and timeline entries for a cross-org collaboration.

Your task: summarize what has changed recently, as if briefing someone who last looked at this Gist a week ago.

Rules:
- Lead with the most significant recent change.
- Use a bulleted list: each bullet is one change, 1 to 2 sentences.
- Categorize changes by type using **bold** prefixes: **New decision:**, **Thread update:**, **Timeline:**, **Content edit:**
- Focus on the 5 to 10 most recent and meaningful changes. Skip trivial edits.
- If nothing has changed recently, write: "No significant changes since last week."
- Target 150 to 300 words.
- Do NOT include a title or header — the UI provides that.`
},
```

#### 1.3c Context Formatting

The current context composition sends raw `JSON.stringify()` for thread messages. Replace with readable formatted text.

**Replace lines 536-543 of `routes.ts`:**

```typescript
function formatThreadsForAI(threads: any[]): string {
  if (threads.length === 0) return "";

  const formatted = threads.map((thread) => {
    const messages = Array.isArray(thread.messages) ? thread.messages : [];
    const messageText = messages
      .map((msg: any) => `  - ${msg.displayName || msg.email || "Anonymous"}: ${msg.content}`)
      .join("\n");
    return `### Thread: ${thread.title || "Untitled"} (${thread.createdAt ? new Date(thread.createdAt).toLocaleDateString() : "no date"})\n${messageText || "  (no messages)"}`;
  }).join("\n\n");

  return `\n\n## Threads (${threads.length})\n\n${formatted}`;
}

function formatTimelineForAI(timeline: any[]): string {
  if (timeline.length === 0) return "";

  const entries = timeline
    .sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime())
    .map((t) => `- ${t.entryDate}: ${t.description}`)
    .join("\n");

  return `\n\n## Timeline (${timeline.length} entries)\n\n${entries}`;
}

// In the handler:
const context = [
  `## Document Content\n\n${gist.markdownSource}`,
  formatThreadsForAI(gistThreads),
  formatTimelineForAI(timeline),
].join("");
```

#### 1.3d Token Cost Awareness

Currently 1 token is deducted per synthesis regardless of model or cost. Since Full Context uses a more expensive model, consider deducting 2 tokens for Full Context and 1 for the others:

```typescript
const tokenCost: Record<string, number> = {
  executive: 1,
  full: 2,
  decisions: 1,
  changed: 2,
};

if (!author.openrouterKey) {
  const cost = tokenCost[viewType] || 1;
  for (let i = 0; i < cost; i++) {
    await storage.decrementAuthorTokens(author.id);
  }
}
```

This is optional — skip it if the complexity isn't worth the fairness. But it aligns cost with value.

---

## Phase 2: Content Structure — Reverse Chron + Collapsible Text Blocks

*The Gist body should be scannable, not a wall of text.*

### 2.1 Reverse-Chronological Authoring

The source file should be reverse-chron. The editor is the enforcement point.

**File:** `client/src/pages/editor.tsx`

When the author adds a new block (decision, thread, text section), it should be **prepended** to the body rather than appended. This means new content appears at the top of the body (after frontmatter), and older content is below.

**For the "Add Decision" flow:**

Wherever a new decision blockquote is inserted into the markdown, insert it immediately after the frontmatter closing `---`, not at the end:

```typescript
function prependBlock(markdown: string, newBlock: string): string {
  // Find the end of frontmatter
  const frontmatterEnd = markdown.match(/^---\n[\s\S]*?\n---\n*/);
  if (frontmatterEnd) {
    const insertPoint = frontmatterEnd[0].length;
    return (
      markdown.slice(0, insertPoint) +
      "\n" + newBlock + "\n\n" +
      markdown.slice(insertPoint)
    );
  }
  // No frontmatter — prepend to top
  return newBlock + "\n\n" + markdown;
}
```

Apply this to all block creation actions: "Add Decision," "Add Thread Reference," "Add Timeline Entry," and any new text section the author creates.

**Do NOT retroactively reorder existing Gists.** They'll render in whatever order they were written, which is fine.

### 2.2 Heading-Based Collapsible Text Blocks

**File:** `client/src/lib/primitives.ts`

The parser currently produces `TextBlock` for any non-blockquote content. Enhance it to detect `##` headings and split text into collapsible sections.

**Add a new block type:**

```typescript
export interface SectionBlock {
  type: "section";
  heading: string;      // The heading text (without ## prefix)
  headingLevel: number; // 2 for ##, preserved for rendering
  content: string;      // Everything between this heading and the next ## heading
}

export type Block = TextBlock | SectionBlock | DecisionBlock | ThreadBlock | TimelineBlock | SnapshotBlock;
```

**Update `parseGistMarkdown()` to split text at `##` boundaries:**

When processing text lines (non-blockquote), accumulate them. When you encounter a line starting with `## ` (h2), flush the accumulated text as a TextBlock (if any) and start a new SectionBlock. Continue accumulating until the next `## ` or blockquote primitive.

```typescript
// Pseudocode for the parsing change:
// If current line starts with "## " AND we have accumulated text lines:
//   → Flush accumulated text as TextBlock (the "cover letter" — pre-heading prose)
//   → Start a new SectionBlock with this heading
// If current line starts with "## " AND we're in a SectionBlock:
//   → Close the current SectionBlock (heading + accumulated content)
//   → Start a new SectionBlock
// Text before the first ## heading → TextBlock (always visible, no collapse)
// Text after a ## heading → part of the current SectionBlock (collapsible)
```

**Key rule:** Text that appears before the first `##` heading in the body is a `TextBlock`, not a `SectionBlock`. It renders as uncollapsible prose — the "cover letter." Everything after a `##` heading is a `SectionBlock` with the heading as the collapse label.

### 2.3 Render SectionBlocks with Collapse

**File:** `client/src/components/markdown-renderer.tsx`

Add a `RenderSectionBlock` case to the `RenderBlock` switch:

```tsx
function RenderSectionBlock({ block }: { block: SectionBlock }) {
  const [isCollapsed, setIsCollapsed] = useState(true); // default collapsed

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center gap-2 w-full text-left py-2 group"
      >
        <ChevronRight
          className={`w-4 h-4 transition-transform duration-100 ${
            isCollapsed ? "" : "rotate-90"
          }`}
          style={{ color: "var(--ink-tertiary)" }}
        />
        <span className="type-h2" style={{ fontSize: "18px" }}>
          {block.heading}
        </span>
        {/* Collapsed preview: first ~80 chars of content */}
        {isCollapsed && block.content && (
          <span
            className="text-[13px] truncate ml-2 flex-1"
            style={{ color: "var(--ink-tertiary)" }}
          >
            {block.content.replace(/[#*>\-\n]/g, " ").trim().slice(0, 80)}…
          </span>
        )}
      </button>
      {!isCollapsed && (
        <div
          className="pl-6 type-body"
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(marked.parse(block.content) as string),
          }}
        />
      )}
    </div>
  );
}
```

**Default state:** SectionBlocks and structured primitives are **collapsed by default.** TextBlocks (pre-heading content) are always visible.

### 2.4 Collapsed State Preview for All Block Types

Add a one-line preview (~80 characters) to all collapsed blocks, not just SectionBlocks.

**File:** `client/src/components/primitive-block.tsx`

Add a `preview` prop:

```tsx
interface PrimitiveBlockProps {
  type: PrimitiveType;
  label: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  preview?: string;          // NEW: one-line preview when collapsed
  children: React.ReactNode;
  meta?: React.ReactNode;
}
```

When collapsed, render the preview alongside the label:

```tsx
{isCollapsed && preview && (
  <span
    className="text-[13px] truncate ml-2 flex-1"
    style={{ color: "var(--ink-tertiary)" }}
  >
    {preview}
  </span>
)}
```

**Preview content per block type:**

- **Decision:** The conclusion field (e.g., "US East Coast as launch market")
- **Thread:** The most recent message, truncated (e.g., "Sarah: I think we should reconsider…")
- **Timeline:** The most recent entry (e.g., "2026-02-10 · Decision made: launch market")
- **SectionBlock:** First ~80 characters of the content

Pass the `preview` prop when rendering each block type. Extract the preview text in the parent renderer.

### 2.5 Snapshot Block Stub

Record the design decision and add the block type now without building the full feature.

**File:** `client/src/lib/primitives.ts`

Add the type definition:

```typescript
export interface SnapshotBlock {
  type: "snapshot";
  description: string;
  url: string;           // External storage URL (future: object storage)
  thumbnailUrl?: string; // Preview image URL (future)
  capturedAt?: string;   // ISO date string
}

// Add to Block union:
export type Block = TextBlock | SectionBlock | DecisionBlock | ThreadBlock | TimelineBlock | SnapshotBlock;
```

**Add parsing for the blockquote convention:**

```
> **Snapshot:** [description](url) · captured YYYY-MM-DD
```

```typescript
// In parseGistMarkdown, add detection:
if (blockquoteContent.startsWith("**Snapshot:**")) {
  // Parse: > **Snapshot:** [desc](url) · captured date
  const match = blockquoteContent.match(
    /\*\*Snapshot:\*\*\s*\[(.+?)\]\((.+?)\)(?:\s*·\s*captured\s*(.+))?/
  );
  if (match) {
    blocks.push({
      type: "snapshot",
      description: match[1],
      url: match[2],
      thumbnailUrl: undefined,
      capturedAt: match[3]?.trim(),
    });
  }
}
```

**Render as a placeholder in `markdown-renderer.tsx`:**

```tsx
function RenderSnapshotBlock({ block }: { block: SnapshotBlock }) {
  return (
    <PrimitiveBlock
      type="snapshot"
      label={`SNAPSHOT: ${block.description}`}
      defaultCollapsed={false}
      preview={block.capturedAt ? `Captured ${block.capturedAt}` : undefined}
    >
      <div className="py-3">
        <a
          href={block.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[14px] font-medium"
          style={{ color: "var(--gist-accent)" }}
        >
          View snapshot →
        </a>
        {block.capturedAt && (
          <span className="type-meta ml-3">{block.capturedAt}</span>
        )}
      </div>
    </PrimitiveBlock>
  );
}
```

Add `"snapshot"` to the `PrimitiveType` union and assign it a border color. Using `--primitive-snapshot` which is already defined in the CSS (`#D4CFC8` light / `#4A453F` dark).

**Decision record:** Snapshots are stored externally (object storage or external URL), rendered inline as an embed block with a link, and exported as a blockquote reference in .md (`> **Snapshot:** [description](url)`). Full Snapshot implementation is deferred to post-V1.

---

## Phase 3: Inline Threads

*Threads should be contextual — attached to the part of the Gist they're about, not piled at the bottom.*

### 3.1 Thread Anchor System

Currently database threads are rendered in a dedicated bottom section with no positional link to the Gist content. Markdown-parsed threads are inline but static (no replies).

**Bridge the two systems.** When a database thread is created, insert a blockquote anchor at the relevant position in the markdown source:

```
> **Thread:** {threadId} · {thread title} · {date}
```

The viewer then matches database threads to their markdown anchors by `threadId` and renders the interactive thread at that position instead of at the bottom.

**Database schema addition — add `anchorBlockIndex` to threads:**

```typescript
// In shared/schema.ts, add to the threads table:
anchorBlockIndex: integer("anchor_block_index"), // index of the block this thread is attached to
```

This records which block position (0-indexed, in the parsed Block[] array) the thread is anchored to. When the viewer parses the Gist, it inserts each database thread after its anchor block.

### 3.2 Thread Creation with Positional Context

**File:** `client/src/pages/viewer.tsx`

Replace the bottom-only "Start Thread" button with a contextual affordance that appears at block boundaries.

**Add a `ThreadAnchor` component that renders between blocks:**

```tsx
function ThreadAnchor({ blockIndex, onStartThread }: {
  blockIndex: number;
  onStartThread: (blockIndex: number) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative h-4 -my-1 group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isHovered && (
        <button
          onClick={() => onStartThread(blockIndex)}
          className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium transition-opacity duration-100"
          style={{
            backgroundColor: "var(--accent-subtle)",
            color: "var(--gist-accent)",
          }}
        >
          <MessageCircle className="w-3 h-3" />
          Start a thread
        </button>
      )}
    </div>
  );
}
```

**In the block rendering loop, interleave `ThreadAnchor` between blocks** and render database threads at their anchor positions:

```tsx
// In MarkdownRenderer, build the render list:
const renderItems: React.ReactNode[] = [];

parsedBlocks.forEach((block, index) => {
  // Render the block
  renderItems.push(<RenderBlock key={`block-${index}`} block={block} />);

  // Render any threads anchored to this block
  const anchoredThreads = databaseThreads.filter(t => t.anchorBlockIndex === index);
  anchoredThreads.forEach((thread) => {
    renderItems.push(
      <InteractiveThread key={`thread-${thread.id}`} thread={thread} />
    );
  });

  // Render thread anchor affordance between blocks
  renderItems.push(
    <ThreadAnchor key={`anchor-${index}`} blockIndex={index} onStartThread={handleStartThread} />
  );
});

// Render orphan threads (no anchor) at the bottom — backward compatibility
const orphanThreads = databaseThreads.filter(t => t.anchorBlockIndex == null);
if (orphanThreads.length > 0) {
  renderItems.push(
    <div key="orphan-threads" className="mt-8 pt-6" style={{ borderTop: "1px solid var(--gist-border)" }}>
      <h2 className="type-h2 mb-4">Threads</h2>
      {orphanThreads.map(t => <InteractiveThread key={t.id} thread={t} />)}
    </div>
  );
}
```

### 3.3 Insert Thread Anchor in Markdown Source

When a new thread is created via the API, also insert a blockquote reference at the anchor position in the markdown source.

**File:** `server/routes.ts` — thread creation handler

After creating the thread in the database, update the markdown source:

```typescript
// After: const thread = await storage.createThread({ ... anchorBlockIndex });

if (anchorBlockIndex != null) {
  const threadRef = `\n\n> **Thread:** ${thread.id} · ${thread.title || "Discussion"} · ${new Date().toISOString().split("T")[0]}\n`;

  // Parse the markdown to find the insertion point after the anchor block
  // Insert the thread reference after block at anchorBlockIndex
  const updatedSource = insertAfterBlock(gist.markdownSource, anchorBlockIndex, threadRef);
  await storage.updateGist(slug, gist.authorId, { markdownSource: updatedSource });
}
```

The `insertAfterBlock` helper parses the markdown just enough to find the end of the Nth block and inserts the reference there. This ensures the .md export includes the thread reference inline where it belongs.

### 3.4 Optimistic Reply Compose

**File:** `client/src/components/primitive-thread.tsx` (or the interactive thread component)

Currently: click "Reply" → enter email → wait for OTP → enter OTP → compose reply.

Change to: reply textarea is **always visible** at the bottom of each thread. The collaborator types their reply. When they click "Submit," THEN the OTP flow triggers. The reply is sent after verification.

```tsx
function ThreadReply({ threadId, onReplySubmitted }: Props) {
  const [replyText, setReplyText] = useState("");
  const [showVerification, setShowVerification] = useState(false);

  const handleSubmit = () => {
    if (!replyText.trim()) return;
    // Check if contributor session exists (cookie)
    if (hasContributorSession()) {
      // Already verified — submit directly
      submitReply(threadId, replyText);
      onReplySubmitted();
    } else {
      // Show email + OTP flow, then submit on success
      setShowVerification(true);
    }
  };

  return (
    <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
      <textarea
        value={replyText}
        onChange={(e) => setReplyText(e.target.value)}
        placeholder="Add to this thread…"
        className="w-full p-3 text-[14px] rounded-interactive resize-none"
        style={{
          backgroundColor: "var(--canvas)",
          border: "1px solid var(--gist-border)",
          color: "var(--ink-primary)",
          minHeight: "72px",
        }}
        rows={2}
      />
      <div className="flex justify-end mt-2">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!replyText.trim()}
        >
          Reply
        </Button>
      </div>

      {showVerification && (
        <OTPVerification
          onVerified={() => {
            submitReply(threadId, replyText);
            setShowVerification(false);
            setReplyText("");
            onReplySubmitted();
          }}
          onCancel={() => setShowVerification(false)}
        />
      )}
    </div>
  );
}
```

The key UX shift: the collaborator can compose while the intent is hot. Verification gates the send, not the compose.

---

## Phase 4: Visual Signals

*Help the collaborator scan, navigate, and orient within the Gist.*

### 4.1 "What's New" Indicator

Show a subtle visual signal on blocks that are new or modified since the collaborator's last visit.

**Mechanism:** Store a `lastVisited` timestamp in a cookie (per-Gist). On page load, compare each block's date against `lastVisited`. Blocks newer than `lastVisited` get a visual indicator.

**For blocks with dates** (decisions, threads, timeline entries): compare the block's date field against `lastVisited`.

**For text blocks / section blocks**: compare the Gist's `updated` timestamp against `lastVisited`. If the Gist was updated since last visit, mark the top-level TextBlock (cover letter) with the indicator.

**Visual treatment:** A 2px left border in `--gist-accent` on the block's outer container, plus a small "NEW" badge:

```tsx
{isNew && (
  <span
    className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
    style={{
      color: "var(--gist-accent)",
      backgroundColor: "var(--accent-subtle)",
    }}
  >
    New
  </span>
)}
```

Place the badge inline with the block label/heading.

**Set the cookie on page load:**

```typescript
// In viewer.tsx, on mount:
useEffect(() => {
  const cookieKey = `gist-visited-${slug}`;
  const lastVisited = getCookie(cookieKey);
  setLastVisitedTimestamp(lastVisited ? new Date(lastVisited) : null);

  // Update the cookie to now
  setCookie(cookieKey, new Date().toISOString(), { maxAge: 365 * 24 * 60 * 60 });
}, [slug]);
```

### 4.2 Block Deep Linking

Each block gets an anchor ID so collaborators can link to specific content.

**Generate stable IDs for blocks:**

```typescript
// In primitives.ts, add an ID to each block:
function generateBlockId(block: Block, index: number): string {
  switch (block.type) {
    case "decision":
      return `decision-${slugify(block.question).slice(0, 40)}`;
    case "thread":
      return `thread-${block.threadId || index}`;
    case "timeline":
      return `timeline`;
    case "section":
      return `section-${slugify(block.heading).slice(0, 40)}`;
    case "snapshot":
      return `snapshot-${index}`;
    default:
      return `block-${index}`;
  }
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
```

**In the renderer, add `id` attributes:**

```tsx
<div id={blockId}>
  <RenderBlock block={block} />
</div>
```

**On page load, scroll to the hash target and auto-expand it:**

```typescript
useEffect(() => {
  const hash = window.location.hash.slice(1);
  if (hash) {
    const element = document.getElementById(hash);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      // Dispatch a custom event or use a ref to expand this block
    }
  }
}, []);
```

### 4.3 Contributor Attribution on Blocks

Show who added a block, when relevant.

**For threads:** Already shows contributor names via display names in messages. No change needed.

**For decisions:** If the decision blockquote includes a "Participants" or "Decided by" field, extract it and show in the block metadata:

```tsx
{block.participants && (
  <span className="type-meta">
    {block.participants}
  </span>
)}
```

**For timeline entries:** Already show dates. The description often includes who did what. No change needed.

**For new SectionBlocks authored by contributors (future):** When a contributor adds content via a thread or direct edit, the block metadata could show "Added by {displayName}." This requires tracking block authorship, which is a post-V1 refinement. For now, thread attribution is sufficient.

---

## What NOT to Change

- Database schema beyond the `anchorBlockIndex` column
- Auth flows (author OTP, contributor OTP)
- Business model logic (1 free Gist, token tracking)
- Font files or @font-face declarations
- Dark mode mechanism
- Export endpoint (it already exports the full markdownSource, which will now include thread anchors and timeline blockquotes)
- Do NOT add a sort toggle or any sort controls to the viewer — content order is determined by the source file, which is reverse-chron by authoring convention
- Do NOT retroactively reorder existing Gists

---

## Implementation Order

1. **Phase 1** first — synthesis is the most visible collaborator touchpoint
2. **Phase 2** next — collapsible blocks make the Gist scannable
3. **Phase 3** next — inline threads make the Gist contextual
4. **Phase 4** last — visual signals are polish on top of structure

Within each phase, implement the deliverables in the order listed.

---

## Definition of Done

**Phase 1: Synthesis**
- [ ] Synthesis output renders as formatted markdown (bold, headers, lists)
- [ ] Synthesis content area has 200px max-height with gradient fade
- [ ] "Show more" / "Show less" toggle works
- [ ] Executive Summary prompt produces 3-5 flowing sentences
- [ ] Full Context prompt produces organized, comprehensive summary with headers
- [ ] Decisions Only prompt produces structured decision list
- [ ] What Changed prompt produces bulleted change list
- [ ] Executive Summary uses `gemini-2.0-flash-001` (fast)
- [ ] Full Context and What Changed use `claude-sonnet-4-20250514` (quality)
- [ ] Fallback to Flash model works when primary fails
- [ ] Thread context is formatted as readable text, not JSON
- [ ] Temperature set per view type (0.1 for decisions, 0.3 for others)

**Phase 2: Content Structure**
- [ ] New blocks are prepended (appear at top of body after frontmatter)
- [ ] Text is split at `##` headings into SectionBlocks
- [ ] Pre-heading text renders as uncollapsible TextBlock (cover letter)
- [ ] SectionBlocks are collapsible with chevron and heading as label
- [ ] All blocks default to collapsed
- [ ] Collapsed blocks show ~80-char preview text
- [ ] Decision preview shows conclusion
- [ ] Thread preview shows most recent message
- [ ] SnapshotBlock type is defined and parses from `> **Snapshot:**` blockquotes
- [ ] SnapshotBlock renders with link and placeholder UI

**Phase 3: Inline Threads**
- [ ] `anchorBlockIndex` column added to threads table
- [ ] Thread anchor affordance appears on hover between blocks
- [ ] New threads are created with anchor position
- [ ] Thread blockquote reference inserted in markdown source at anchor
- [ ] Database threads render at their anchor position in the viewer
- [ ] Orphan threads (no anchor) still render at bottom — backward compatible
- [ ] Reply textarea is always visible (no OTP gate on compose)
- [ ] OTP verification triggers on submit, not on compose
- [ ] Verified contributors (existing session cookie) can reply without re-verifying

**Phase 4: Visual Signals**
- [ ] `lastVisited` cookie set per-Gist on page load
- [ ] Blocks newer than `lastVisited` show "NEW" badge
- [ ] Each block has a stable anchor ID
- [ ] URL hash scrolls to and auto-expands the target block
- [ ] Deep links work when shared (e.g., `gist.works/g/abc123#decision-launch-market`)

**Cross-cutting**
- [ ] Dark mode works on all new components
- [ ] All interactive elements are 44px × 44px minimum touch targets
- [ ] No layout shift during content loading
- [ ] All existing v0.5.0 functionality still works (no regressions)
- [ ] Exported .md includes thread anchors inline
