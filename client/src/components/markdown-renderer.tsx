import { useState, useMemo, useEffect, useCallback } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { parseGistMarkdown, generateBlockId, type Block, type SectionBlock, type SnapshotBlock } from "@/lib/primitives";
import PrimitiveDecision from "./primitive-decision";
import PrimitiveThread from "./primitive-thread";
import PrimitiveTimeline from "./primitive-timeline";
import PrimitiveBlock from "./primitive-block";
import { Button } from "@/components/ui/button";
import { MessageSquarePlus, ChevronRight, MessageCircle } from "lucide-react";

interface Props {
  markdown: string;
  canContribute?: boolean;
  onAddThreadMessage?: () => void;
  threads?: Array<{ id: string; messages: any[]; source: string; createdAt: string | Date; anchorBlockIndex?: number | null }>;
  onThreadReply?: (threadId: string, message: string) => void;
  isReplying?: boolean;
  onRequestVerify?: (threadId?: string) => void;
  onStartThreadAtBlock?: (blockIndex: number) => void;
  lastVisited?: Date | null;
}

function RenderTextBlock({ content }: { content: string }) {
  const html = useMemo(() => {
    const raw = marked.parse(content, { async: false }) as string;
    return DOMPurify.sanitize(raw);
  }, [content]);

  return (
    <div
      className="prose prose-stone max-w-none"
      style={{
        color: "var(--ink-secondary)",
        fontSize: "15px",
        lineHeight: "1.65",
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function RenderSectionBlock({ block }: { block: SectionBlock }) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  const html = useMemo(() => {
    if (!block.content) return "";
    const raw = marked.parse(block.content, { async: false }) as string;
    return DOMPurify.sanitize(raw);
  }, [block.content]);

  const preview = block.content
    ? block.content.replace(/[#*>\-\n]/g, " ").trim().slice(0, 80)
    : "";

  return (
    <div className="mb-4" data-testid={`section-${block.heading}`}>
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center gap-2 w-full text-left py-2"
        data-testid={`button-toggle-section`}
      >
        <ChevronRight
          className={`w-4 h-4 transition-transform duration-100 flex-shrink-0 ${
            isCollapsed ? "" : "rotate-90"
          }`}
          style={{ color: "var(--ink-tertiary)" }}
        />
        <span className="type-h2" style={{ fontSize: "18px" }}>
          {block.heading}
        </span>
        {isCollapsed && preview && (
          <span
            className="text-[13px] truncate ml-2 flex-1"
            style={{ color: "var(--ink-tertiary)" }}
          >
            {preview}...
          </span>
        )}
      </button>
      {!isCollapsed && html && (
        <div
          className="pl-6 type-body"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}

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
          data-testid="link-snapshot"
        >
          View snapshot
        </a>
        {block.capturedAt && (
          <span className="type-meta ml-3">{block.capturedAt}</span>
        )}
      </div>
    </PrimitiveBlock>
  );
}

function ThreadAnchor({ blockIndex, onStartThread }: {
  blockIndex: number;
  onStartThread: (blockIndex: number) => void;
}) {
  return (
    <div
      className="relative h-4 -my-1 group"
    >
      <button
        onClick={() => onStartThread(blockIndex)}
        className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-100"
        style={{
          backgroundColor: "var(--accent-subtle)",
          color: "var(--gist-accent)",
        }}
        data-testid={`button-thread-anchor-${blockIndex}`}
      >
        <MessageCircle className="w-3 h-3" />
        Start a thread
      </button>
    </div>
  );
}

function RenderBlock({ block, isNew, blockId }: { block: Block; isNew?: boolean; blockId?: string }) {
  const newBadge = isNew ? (
    <span
      className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ml-2"
      style={{
        color: "var(--gist-accent)",
        backgroundColor: "var(--accent-subtle)",
      }}
      data-testid="badge-new"
    >
      New
    </span>
  ) : null;

  switch (block.type) {
    case "text":
      return (
        <div className="flex items-start gap-2">
          <div className="flex-1"><RenderTextBlock content={block.content} /></div>
          {newBadge}
        </div>
      );
    case "section":
      return <RenderSectionBlock block={block} />;
    case "decision":
      return <PrimitiveDecision decision={block} isNew={isNew} blockId={blockId} />;
    case "thread":
      return (
        <PrimitiveThread
          thread={block}
          canContribute={false}
          isNew={isNew}
        />
      );
    case "timeline":
      return <PrimitiveTimeline timeline={block} isNew={isNew} blockId={blockId} />;
    case "snapshot":
      return <RenderSnapshotBlock block={block} />;
    default:
      return null;
  }
}

export default function MarkdownRenderer({
  markdown,
  canContribute,
  onAddThreadMessage,
  threads,
  onThreadReply,
  isReplying,
  onRequestVerify,
  onStartThreadAtBlock,
  lastVisited,
}: Props) {
  const parsed = useMemo(() => parseGistMarkdown(markdown), [markdown]);

  const hasDbThreads = threads !== undefined;
  const blocksToRender = hasDbThreads
    ? parsed.body.filter(b => b.type !== "thread")
    : parsed.body;

  const handleStartThread = (blockIndex: number) => {
    if (onStartThreadAtBlock) {
      onStartThreadAtBlock(blockIndex);
    } else if (onAddThreadMessage) {
      onAddThreadMessage();
    }
  };

  function isBlockNew(block: Block, _index: number): boolean {
    if (!lastVisited) return false;
    if (block.type === "decision" && block.decided) {
      const d = new Date(block.decided);
      return !isNaN(d.getTime()) && d > lastVisited;
    }
    if (block.type === "thread" && block.date) {
      const d = new Date(block.date);
      return !isNaN(d.getTime()) && d > lastVisited;
    }
    if (block.type === "timeline" && block.entries.length > 0) {
      const latest = block.entries[0];
      if (latest.date) {
        const d = new Date(latest.date);
        return !isNaN(d.getTime()) && d > lastVisited;
      }
    }
    return false;
  }

  const renderItems: React.ReactNode[] = [];

  blocksToRender.forEach((block, index) => {
    const blockId = generateBlockId(block, index);
    const isNew = isBlockNew(block, index);

    renderItems.push(
      <div key={`block-${index}`} id={blockId}>
        <RenderBlock block={block} isNew={isNew} blockId={blockId} />
      </div>
    );

    if (hasDbThreads) {
      const anchoredThreads = (threads || []).filter(t => t.anchorBlockIndex === index);
      anchoredThreads.forEach((dbThread) => {
        const threadBlock = {
          type: "thread" as const,
          source: dbThread.source || "Native",
          date: typeof dbThread.createdAt === "string"
            ? new Date(dbThread.createdAt).toLocaleDateString()
            : dbThread.createdAt.toLocaleDateString(),
          messages: (dbThread.messages || []).map((m: any) => ({
            authorName: m.authorName || "Unknown",
            body: m.body || "",
          })),
        };

        const isThreadNew = lastVisited ? new Date(dbThread.createdAt) > lastVisited : false;

        renderItems.push(
          <PrimitiveThread
            key={`thread-${dbThread.id}`}
            thread={threadBlock}
            threadId={dbThread.id}
            canContribute={canContribute}
            onReply={onThreadReply}
            isReplying={isReplying}
            onRequestVerify={onRequestVerify}
            isNew={isThreadNew}
          />
        );
      });
    }

    if (onStartThreadAtBlock || onAddThreadMessage) {
      renderItems.push(
        <ThreadAnchor
          key={`anchor-${index}`}
          blockIndex={index}
          onStartThread={handleStartThread}
        />
      );
    }
  });

  const orphanThreads = hasDbThreads
    ? (threads || []).filter(t => t.anchorBlockIndex == null)
    : [];

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        const toggle = el.querySelector(`[data-block-toggle="${hash}"]`);
        if (toggle instanceof HTMLElement) {
          toggle.click();
        } else {
          const sectionToggle = el.querySelector("[data-testid='button-toggle-section']");
          if (sectionToggle instanceof HTMLElement) {
            sectionToggle.click();
          }
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="content-width" data-testid="markdown-renderer">
      {renderItems}

      {orphanThreads.length > 0 && (
        <div className="mt-8 pt-6 space-y-4" style={{ borderTop: "1px solid var(--gist-border)" }} data-testid="threads-section">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3
              className="primitive-label"
              style={{ color: "var(--ink-tertiary)" }}
            >
              Threads ({orphanThreads.length})
            </h3>
            {onAddThreadMessage && (
              <Button
                variant="outline"
                size="sm"
                onClick={canContribute ? onAddThreadMessage : () => onRequestVerify?.()}
                data-testid="button-start-new-thread"
              >
                <MessageSquarePlus className="w-3.5 h-3.5 mr-1.5" />
                New thread
              </Button>
            )}
          </div>
          {orphanThreads.map((dbThread) => {
            const threadBlock = {
              type: "thread" as const,
              source: dbThread.source || "Native",
              date: typeof dbThread.createdAt === "string"
                ? new Date(dbThread.createdAt).toLocaleDateString()
                : dbThread.createdAt.toLocaleDateString(),
              messages: (dbThread.messages || []).map((m: any) => ({
                authorName: m.authorName || "Unknown",
                body: m.body || "",
              })),
            };

            return (
              <PrimitiveThread
                key={dbThread.id}
                thread={threadBlock}
                threadId={dbThread.id}
                canContribute={canContribute}
                onReply={onThreadReply}
                isReplying={isReplying}
                onRequestVerify={onRequestVerify}
              />
            );
          })}
        </div>
      )}

      {orphanThreads.length === 0 && !hasDbThreads && onAddThreadMessage && (
        <div className="mt-8" data-testid="no-threads-section">
          <Button
            variant="outline"
            size="sm"
            onClick={canContribute ? onAddThreadMessage : () => onRequestVerify?.()}
            data-testid="button-start-new-thread"
          >
            <MessageSquarePlus className="w-3.5 h-3.5 mr-1.5" />
            Start a thread
          </Button>
        </div>
      )}
    </div>
  );
}

export { parseGistMarkdown };
