export interface FrontMatter {
  title: string;
  created?: string;
  updated?: string;
  contributors?: string[];
}

export interface TextBlock {
  type: "text";
  content: string;
}

export interface SectionBlock {
  type: "section";
  heading: string;
  headingLevel: number;
  content: string;
}

export interface DecisionBlock {
  type: "decision";
  question: string;
  options: string[];
  evidence: string;
  conclusion: string;
  rationale: string;
  decided: string;
  participants: string[];
}

export interface ThreadMessageParsed {
  authorName: string;
  body: string;
}

export interface ThreadBlock {
  type: "thread";
  source: string;
  date: string;
  messages: ThreadMessageParsed[];
  messageCount?: number;
  participantCount?: number;
  threadId?: string;
}

export interface TimelineEntryParsed {
  date: string;
  description: string;
}

export interface TimelineBlock {
  type: "timeline";
  entries: TimelineEntryParsed[];
}

export interface SnapshotBlock {
  type: "snapshot";
  description: string;
  url: string;
  thumbnailUrl?: string;
  capturedAt?: string;
}

export type Block = TextBlock | SectionBlock | DecisionBlock | ThreadBlock | TimelineBlock | SnapshotBlock;

export interface ParsedGist {
  frontmatter: FrontMatter;
  body: Block[];
}

function parseFrontmatter(content: string): { frontmatter: FrontMatter; rest: string } {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) {
    return {
      frontmatter: { title: "Untitled" },
      rest: content,
    };
  }

  const fmStr = fmMatch[1];
  const rest = fmMatch[2];
  const fm: FrontMatter = { title: "Untitled" };

  for (const line of fmStr.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (key === "title") fm.title = value;
    else if (key === "created") fm.created = value;
    else if (key === "updated") fm.updated = value;
    else if (key === "contributors") {
      fm.contributors = value.split(",").map((c) => c.trim()).filter(Boolean);
    }
  }

  return { frontmatter: fm, rest };
}

function parseDecisionBlock(lines: string[]): DecisionBlock {
  const block: DecisionBlock = {
    type: "decision",
    question: "",
    options: [],
    evidence: "",
    conclusion: "",
    rationale: "",
    decided: "",
    participants: [],
  };

  const firstLine = lines[0] || "";
  const qMatch = firstLine.match(/\*\*Decision:\*\*\s*(.*)/);
  if (qMatch) block.question = qMatch[1].trim();

  for (const line of lines.slice(1)) {
    const clean = line.replace(/^>\s*[-*]?\s*/, "").trim();
    if (clean.startsWith("**Options:**")) {
      block.options = clean.replace("**Options:**", "").split("|").map((o) => o.trim()).filter(Boolean);
    } else if (clean.startsWith("**Evidence:**")) {
      block.evidence = clean.replace("**Evidence:**", "").trim();
    } else if (clean.startsWith("**Conclusion:**")) {
      block.conclusion = clean.replace("**Conclusion:**", "").trim();
    } else if (clean.startsWith("**Rationale:**")) {
      block.rationale = clean.replace("**Rationale:**", "").trim();
    } else if (clean.startsWith("**Decided:**")) {
      const decidedStr = clean.replace("**Decided:**", "").trim();
      const parts = decidedStr.split("·").map((p) => p.trim());
      block.decided = parts[0] || "";
      if (parts[1]) {
        block.participants = parts[1].split(",").map((p) => p.trim()).filter(Boolean);
      }
    }
  }

  return block;
}

function parseThreadBlock(lines: string[]): ThreadBlock {
  const block: ThreadBlock = {
    type: "thread",
    source: "Native",
    date: "",
    messages: [],
  };

  const firstLine = lines[0] || "";
  const srcMatch = firstLine.match(/\*\*Thread:\*\*\s*(.*)/);
  if (srcMatch) {
    const parts = srcMatch[1].split("·").map((p) => p.trim());
    if (parts.length >= 3) {
      block.threadId = parts[0] || undefined;
      block.source = parts[1] || "Native";
      block.date = parts[2] || "";
    } else {
      block.source = parts[0] || "Native";
      block.date = parts[1] || "";
    }
  }

  for (const line of lines.slice(1)) {
    const clean = line.replace(/^>\s*[-*]?\s*/, "").trim();
    const msgMatch = clean.match(/^\*\*(.+?):\*\*\s*(.*)/);
    if (msgMatch) {
      block.messages.push({
        authorName: msgMatch[1].trim(),
        body: msgMatch[2].trim(),
      });
    } else {
      const countMatch = clean.match(/(\d+)\s+messages?\s*·\s*(\d+)\s+participants?/);
      if (countMatch) {
        block.messageCount = parseInt(countMatch[1]);
        block.participantCount = parseInt(countMatch[2]);
      }
    }
  }

  return block;
}

function parseTimelineBlock(lines: string[]): TimelineBlock {
  const block: TimelineBlock = {
    type: "timeline",
    entries: [],
  };

  for (const line of lines.slice(1)) {
    const clean = line.replace(/^>\s*[-*]?\s*/, "").trim();
    if (!clean) continue;
    const dotIdx = clean.indexOf("·");
    if (dotIdx !== -1) {
      block.entries.push({
        date: clean.slice(0, dotIdx).trim(),
        description: clean.slice(dotIdx + 1).trim(),
      });
    } else {
      block.entries.push({
        date: "",
        description: clean,
      });
    }
  }

  return block;
}

function parseSnapshotBlock(lines: string[]): SnapshotBlock | null {
  const firstLine = lines[0] || "";
  const content = firstLine.replace(/^>\s*/, "").trim();
  const match = content.match(
    /\*\*Snapshot:\*\*\s*\[(.+?)\]\((.+?)\)(?:\s*·\s*captured\s*(.+))?/
  );
  if (match) {
    return {
      type: "snapshot",
      description: match[1],
      url: match[2],
      thumbnailUrl: undefined,
      capturedAt: match[3]?.trim(),
    };
  }
  return null;
}

export function parseGistMarkdown(markdown: string): ParsedGist {
  const { frontmatter, rest } = parseFrontmatter(markdown);
  const lines = rest.split("\n");
  const blocks: Block[] = [];
  let currentText: string[] = [];
  let blockquoteLines: string[] = [];
  let inBlockquote = false;
  let currentSection: { heading: string; headingLevel: number; lines: string[] } | null = null;
  let hadHeading = false;

  function flushText() {
    const text = currentText.join("\n").trim();
    if (text) {
      blocks.push({ type: "text", content: text });
    }
    currentText = [];
  }

  function flushSection() {
    if (!currentSection) return;
    const content = currentSection.lines.join("\n").trim();
    blocks.push({
      type: "section",
      heading: currentSection.heading,
      headingLevel: currentSection.headingLevel,
      content,
    });
    currentSection = null;
  }

  function flushBlockquote() {
    if (blockquoteLines.length === 0) return;

    const firstLine = blockquoteLines[0].replace(/^>\s*/, "").trim();

    if (firstLine.startsWith("**Decision:**")) {
      flushText();
      flushSection();
      blocks.push(parseDecisionBlock(blockquoteLines));
    } else if (firstLine.startsWith("**Thread:**")) {
      flushText();
      flushSection();
      blocks.push(parseThreadBlock(blockquoteLines));
    } else if (firstLine.startsWith("**Timeline:**")) {
      flushText();
      flushSection();
      blocks.push(parseTimelineBlock(blockquoteLines));
    } else if (firstLine.startsWith("**Snapshot:**")) {
      flushText();
      flushSection();
      const snap = parseSnapshotBlock(blockquoteLines);
      if (snap) blocks.push(snap);
    } else {
      if (currentSection) {
        for (const l of blockquoteLines) {
          currentSection.lines.push(l);
        }
      } else {
        for (const l of blockquoteLines) {
          currentText.push(l);
        }
      }
    }

    blockquoteLines = [];
  }

  for (const line of lines) {
    const isBlockquote = line.startsWith(">");

    if (isBlockquote) {
      if (!inBlockquote) {
        inBlockquote = true;
      }
      blockquoteLines.push(line);
    } else {
      if (inBlockquote) {
        inBlockquote = false;
        flushBlockquote();
      }

      const headingMatch = line.match(/^(#{2})\s+(.+)$/);
      if (headingMatch) {
        if (!hadHeading) {
          flushText();
          hadHeading = true;
        } else {
          flushSection();
        }
        currentSection = {
          heading: headingMatch[2].trim(),
          headingLevel: headingMatch[1].length,
          lines: [],
        };
      } else if (currentSection) {
        currentSection.lines.push(line);
      } else {
        currentText.push(line);
      }
    }
  }

  if (inBlockquote) {
    flushBlockquote();
  }
  flushSection();
  flushText();

  return { frontmatter, body: blocks };
}

export function prependBlock(markdown: string, newBlock: string): string {
  const frontmatterEnd = markdown.match(/^---\n[\s\S]*?\n---\n*/);
  if (frontmatterEnd) {
    const insertPoint = frontmatterEnd[0].length;
    return (
      markdown.slice(0, insertPoint) +
      "\n" + newBlock + "\n\n" +
      markdown.slice(insertPoint)
    );
  }
  return newBlock + "\n\n" + markdown;
}

export function insertAfterBlock(markdown: string, blockIndex: number, insertText: string): string {
  const { rest } = parseFrontmatter(markdown);
  const fmEnd = markdown.indexOf(rest);
  const lines = rest.split("\n");

  let currentBlock = -1;
  let inBlockquote = false;
  let lastBlockEndLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isBlockquote = line.startsWith(">");
    const isHeading = /^#{2}\s+/.test(line);
    const isEmpty = line.trim() === "";

    if (isBlockquote && !inBlockquote) {
      inBlockquote = true;
      currentBlock++;
    } else if (!isBlockquote && inBlockquote) {
      inBlockquote = false;
      lastBlockEndLine = i;
      if (currentBlock === blockIndex) break;
    }

    if (!isBlockquote && !isEmpty && !inBlockquote) {
      if (isHeading || (i === 0 && !isEmpty)) {
        if (currentBlock >= 0 && lastBlockEndLine < i) {
          lastBlockEndLine = i;
        }
        currentBlock++;
        if (currentBlock > blockIndex) {
          lastBlockEndLine = i;
          break;
        }
      }
    }

    if (i === lines.length - 1) {
      lastBlockEndLine = i + 1;
    }
  }

  const beforeLines = lines.slice(0, lastBlockEndLine);
  const afterLines = lines.slice(lastBlockEndLine);
  const before = beforeLines.join("\n");
  const after = afterLines.join("\n");

  return markdown.slice(0, fmEnd) + before + insertText + after;
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function generateBlockId(block: Block, index: number): string {
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

export function generateDecisionMarkdown(decision: {
  question: string;
  options: string[];
  evidence: string;
  conclusion: string;
  rationale: string;
  date: string;
  participants: string[];
}): string {
  const lines: string[] = [];
  lines.push(`> **Decision:** ${decision.question}`);
  if (decision.options.length > 0) {
    lines.push(`> - **Options:** ${decision.options.join(" | ")}`);
  }
  if (decision.evidence) {
    lines.push(`> - **Evidence:** ${decision.evidence}`);
  }
  lines.push(`> - **Conclusion:** ${decision.conclusion}`);
  if (decision.rationale) {
    lines.push(`> - **Rationale:** ${decision.rationale}`);
  }
  const participantsStr = decision.participants.length > 0 ? ` · ${decision.participants.join(", ")}` : "";
  lines.push(`> - **Decided:** ${decision.date}${participantsStr}`);
  return lines.join("\n");
}

export function generateThreadMarkdown(thread: {
  source: string;
  date: string;
  messages: { authorName: string; body: string }[];
}): string {
  const lines: string[] = [];
  lines.push(`> **Thread:** ${thread.source} · ${thread.date}`);
  for (const msg of thread.messages) {
    lines.push(`> - **${msg.authorName}:** ${msg.body}`);
  }
  lines.push(`> - ${thread.messages.length} messages · ${new Set(thread.messages.map((m) => m.authorName)).size} participants`);
  return lines.join("\n");
}

export function generateTimelineEntryMarkdown(entry: {
  date: string;
  description: string;
}): string {
  return `> - ${entry.date} · ${entry.description}`;
}
