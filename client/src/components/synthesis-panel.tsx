import { useState, useCallback, useRef, useEffect } from "react";
import { Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { marked } from "marked";
import DOMPurify from "dompurify";

type ViewType = "executive" | "full" | "decisions" | "changed";

interface Props {
  slug: string;
  isAuthor?: boolean;
  hasTokens?: boolean;
}

const viewLabels: Record<ViewType, string> = {
  executive: "Executive Summary",
  full: "Full Context",
  decisions: "Decisions Only",
  changed: "What Changed",
};

export default function SynthesisPanel({ slug, isAuthor, hasTokens = true }: Props) {
  const [activeView, setActiveView] = useState<ViewType>("executive");
  const [content, setContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [synthesizedAt, setSynthesizedAt] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [needsExpand, setNeedsExpand] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (contentRef.current && content) {
      setNeedsExpand(contentRef.current.scrollHeight > 200);
    }
  }, [content]);

  const synthesize = useCallback(async (viewType: ViewType) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsStreaming(true);
    setError(null);
    setContent("");
    setActiveView(viewType);
    setIsExpanded(false);
    setNeedsExpand(false);

    try {
      const res = await fetch(`/api/g/${slug}/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewType }),
        credentials: "include",
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Synthesis failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                accumulated += parsed.content;
                setContent(accumulated);
              }
            } catch {}
          }
        }
      }

      setSynthesizedAt(new Date().toLocaleTimeString());
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError(err.message || "Synthesis unavailable right now. You can still read the full Gist below.");
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [slug]);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return (
    <div
      className="rounded-structural p-6 mb-8 shadow-subtle"
      style={{
        backgroundColor: "var(--canvas-raised)",
        borderTop: "2px solid var(--accent-subtle)",
      }}
      data-testid="synthesis-panel"
    >
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" style={{ color: "var(--gist-accent)" }} />
          <span className="text-[15px] font-semibold" style={{ color: "var(--ink-primary)" }}>
            Synthesis
          </span>
          {synthesizedAt && (
            <span className="type-meta-emphasis">
              · Synthesized {synthesizedAt}
            </span>
          )}
        </div>
        {!isStreaming && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => synthesize(activeView)}
            disabled={!hasTokens}
            data-testid="button-synthesize"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            {content ? "Regenerate" : "Synthesize"}
          </Button>
        )}
      </div>

      <div className="flex gap-1 mb-4 flex-wrap">
        {(Object.keys(viewLabels) as ViewType[]).map((vt) => (
          <button
            key={vt}
            onClick={() => {
              if (content || isStreaming) {
                synthesize(vt);
              } else {
                setActiveView(vt);
              }
            }}
            className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors duration-100`}
            style={{
              backgroundColor: activeView === vt ? "var(--accent-subtle)" : "transparent",
              color: activeView === vt ? "var(--gist-accent)" : "var(--ink-tertiary)",
            }}
            data-testid={`button-view-${vt}`}
          >
            {viewLabels[vt]}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-md mb-4" style={{ backgroundColor: "var(--border-subtle)" }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "var(--gist-error)" }} />
          <p className="text-[13px]" style={{ color: "var(--ink-secondary)" }}>
            {error}
          </p>
        </div>
      )}

      {!hasTokens && !content && (
        <div className="p-4 rounded-md" style={{ backgroundColor: "var(--accent-subtle)" }}>
          <p className="text-[14px] mb-2" style={{ color: "var(--ink-primary)" }}>
            You've used your included tokens.
          </p>
          <p className="text-[13px]" style={{ color: "var(--ink-secondary)" }}>
            Add your OpenRouter key in Settings to keep synthesizing. Your Gist is still fully readable and editable.
          </p>
        </div>
      )}

      {(content || isStreaming) && (
        <div className="relative">
          <div
            ref={contentRef}
            className="prose-synthesis overflow-hidden transition-[max-height] duration-150 ease-out"
            style={{
              maxHeight: isExpanded ? `${contentRef.current?.scrollHeight || 2000}px` : "200px",
              color: "var(--ink-secondary)",
            }}
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

          {needsExpand && !isExpanded && (
            <div
              className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
              style={{
                background: `linear-gradient(transparent, var(--canvas-raised))`,
              }}
            />
          )}

          {needsExpand && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-2 text-[13px] font-medium"
              style={{ color: "var(--gist-accent)" }}
              data-testid="button-expand-synthesis"
            >
              {isExpanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}

      {!content && !isStreaming && !error && hasTokens && (
        <div
          className="text-center py-8 text-[14px]"
          style={{ color: "var(--ink-tertiary)" }}
        >
          Click Synthesize to generate an AI summary of this Gist
        </div>
      )}
    </div>
  );
}
