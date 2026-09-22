import { useState, useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import MarkdownRenderer from "./markdown-renderer";
import PrimitiveThread from "./primitive-thread";
import { MessageCircle } from "lucide-react";

const EDITOR_MOBILE_BREAKPOINT = 640;

function useIsEditorMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${EDITOR_MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(window.innerWidth < EDITOR_MOBILE_BREAKPOINT);
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < EDITOR_MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  threads?: Array<{ id: string; messages: any[]; source: string; createdAt: string | Date }>;
  onThreadReply?: (threadId: string, message: string) => void;
  isReplying?: boolean;
}

export default function GistEditor({ value, onChange, threads, onThreadReply, isReplying }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const isMobile = useIsEditorMobile();
  const [mobileView, setMobileView] = useState<"edit" | "preview" | "threads">("edit");

  useEffect(() => {
    if (!editorRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        markdown(),
        EditorView.lineWrapping,
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        syntaxHighlighting(defaultHighlightStyle),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          "&": {
            fontSize: "14px",
            fontFamily: "var(--font-sans)",
            height: "100%",
          },
          ".cm-content": {
            fontFamily: "var(--font-mono)",
            padding: "16px",
            caretColor: "var(--gist-accent)",
          },
          ".cm-line": {
            padding: "0 4px",
            lineHeight: "1.65",
          },
          "&.cm-focused": {
            outline: "none",
          },
          ".cm-gutters": {
            display: "none",
          },
          ".cm-scroller": {
            overflow: "auto",
          },
          ".cm-cursor": {
            borderLeftColor: "var(--gist-accent)",
          },
          ".cm-selectionBackground": {
            backgroundColor: "var(--accent-subtle) !important",
          },
          "&.cm-focused .cm-selectionBackground": {
            backgroundColor: "var(--accent-subtle) !important",
          },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });
    viewRef.current = view;

    return () => {
      view.destroy();
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== value) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: value },
      });
    }
  }, [value]);

  const threadCount = threads?.length ?? 0;

  if (isMobile) {
    return (
      <div className="flex flex-col h-full" data-testid="gist-editor">
        <div
          className="flex border-b"
          style={{ borderColor: "var(--gist-border)" }}
        >
          <button
            onClick={() => setMobileView("edit")}
            className="flex-1 py-2.5 text-[13px] font-medium transition-colors duration-100"
            style={{
              color: mobileView === "edit" ? "var(--gist-accent)" : "var(--ink-tertiary)",
              borderBottom: mobileView === "edit" ? "2px solid var(--gist-accent)" : "2px solid transparent",
            }}
            data-testid="button-mobile-edit"
          >
            Edit
          </button>
          <button
            onClick={() => setMobileView("preview")}
            className="flex-1 py-2.5 text-[13px] font-medium transition-colors duration-100"
            style={{
              color: mobileView === "preview" ? "var(--gist-accent)" : "var(--ink-tertiary)",
              borderBottom: mobileView === "preview" ? "2px solid var(--gist-accent)" : "2px solid transparent",
            }}
            data-testid="button-mobile-preview"
          >
            Preview
          </button>
          <button
            onClick={() => setMobileView("threads")}
            className="flex-1 py-2.5 text-[13px] font-medium transition-colors duration-100"
            style={{
              color: mobileView === "threads" ? "var(--gist-accent)" : "var(--ink-tertiary)",
              borderBottom: mobileView === "threads" ? "2px solid var(--gist-accent)" : "2px solid transparent",
            }}
            data-testid="button-mobile-threads"
          >
            Threads{threadCount > 0 ? ` (${threadCount})` : ""}
          </button>
        </div>

        {mobileView === "edit" && (
          <div className="flex-1 overflow-auto" style={{ backgroundColor: "var(--canvas)" }}>
            <div ref={editorRef} className="h-full" data-testid="editor-codemirror" />
          </div>
        )}
        {mobileView === "preview" && (
          <div className="flex-1 overflow-auto p-4" style={{ backgroundColor: "var(--canvas)" }}>
            <div className="content-width mx-auto" data-testid="editor-preview">
              <MarkdownRenderer
                markdown={value}
                threads={threads}
                canContribute={true}
                onThreadReply={onThreadReply}
                isReplying={isReplying}
              />
            </div>
          </div>
        )}
        {mobileView === "threads" && (
          <div className="flex-1 overflow-auto p-4" style={{ backgroundColor: "var(--canvas)" }}>
            <div className="content-width mx-auto" data-testid="editor-threads">
              {threadCount > 0 ? (
                <div className="space-y-4">
                  <h3
                    className="primitive-label"
                    style={{ color: "var(--ink-tertiary)" }}
                  >
                    Threads ({threadCount})
                  </h3>
                  {threads!.map((dbThread) => {
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
                        canContribute={true}
                        onReply={onThreadReply}
                        isReplying={isReplying}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12" data-testid="threads-empty">
                  <MessageCircle className="w-8 h-8 mb-3" style={{ color: "var(--ink-tertiary)" }} />
                  <p className="type-body" style={{ color: "var(--ink-tertiary)" }}>
                    No threads yet
                  </p>
                  <p className="type-small mt-1" style={{ color: "var(--ink-tertiary)" }}>
                    Add a thread from the toolbar to start a discussion
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full" data-testid="gist-editor">
      <div
        className="flex-1 min-w-0 overflow-hidden border-r"
        style={{ borderColor: "var(--gist-border)" }}
      >
        <div className="h-full overflow-auto" style={{ backgroundColor: "var(--canvas)" }}>
          <div ref={editorRef} className="h-full" data-testid="editor-codemirror" />
        </div>
      </div>

      <div className="flex-1 min-w-0 overflow-auto p-6" style={{ backgroundColor: "var(--canvas)" }}>
        <div className="content-width mx-auto" data-testid="editor-preview">
          <MarkdownRenderer
            markdown={value}
            threads={threads}
            canContribute={true}
            onThreadReply={onThreadReply}
            isReplying={isReplying}
          />
        </div>
      </div>
    </div>
  );
}
