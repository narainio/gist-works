import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import GistEditor from "@/components/gist-editor";
import EditorToolbar from "@/components/editor-toolbar";
import ShareLink from "@/components/share-link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Download, Trash2, Eye, Check } from "lucide-react";
import { GistLogo } from "@/components/gist-logo";
import type { Gist, Thread } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

const AUTO_SAVE_DELAY = 2000;

function parseFrontmatter(source: string): { title: string; updated: string; body: string } {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { title: "", updated: "", body: source };
  const yaml = match[1];
  const body = match[2];
  let title = "";
  let updated = "";
  for (const line of yaml.split("\n")) {
    const titleMatch = line.match(/^title:\s*(.+)$/);
    if (titleMatch) title = titleMatch[1].trim();
    const updatedMatch = line.match(/^updated:\s*(.+)$/);
    if (updatedMatch) updated = updatedMatch[1].trim();
  }
  return { title, updated, body };
}

function buildFullMarkdown(title: string, body: string): string {
  const today = new Date().toISOString().split("T")[0];
  return `---\ntitle: ${title}\nupdated: ${today}\n---\n${body}`;
}

function relativeTime(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Updated just now";
  if (diffMins < 60) return `Updated ${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Updated ${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `Updated ${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  return `Updated ${dateStr}`;
}

export default function EditorPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  const { data: gist, isLoading } = useQuery<Gist>({
    queryKey: ["/api/gists", slug, "edit"],
    queryFn: async () => {
      const res = await fetch(`/api/gists/${slug}/manage`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load gist");
      return res.json();
    },
    enabled: !!slug && isAuthenticated,
  });

  const { data: threadsData } = useQuery<{ threads: Thread[] }>({
    queryKey: ["/api/g", slug, "threads"],
    queryFn: async () => {
      const res = await fetch(`/api/g/${slug}`, { credentials: "include" });
      if (!res.ok) return { threads: [] };
      const data = await res.json();
      return { threads: data.threads || [] };
    },
    enabled: !!slug && isAuthenticated,
    refetchInterval: 10000,
  });

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [updatedDate, setUpdatedDate] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadRef = useRef(true);

  useEffect(() => {
    if (gist && initialLoadRef.current) {
      const parsed = parseFrontmatter(gist.markdownSource);
      setTitle(parsed.title || gist.title);
      setBody(parsed.body);
      setUpdatedDate(parsed.updated);
      initialLoadRef.current = false;
    }
  }, [gist]);

  const fullMarkdown = useMemo(() => buildFullMarkdown(title, body), [title, body]);

  const saveGist = useMutation({
    mutationFn: async ({ silent }: { silent?: boolean } = {}) => {
      const updatedMd = buildFullMarkdown(title, body);
      await apiRequest("PUT", `/api/gists/${slug}`, {
        title,
        markdownSource: updatedMd,
      });
      return { silent };
    },
    onSuccess: (_, variables) => {
      setHasChanges(false);
      setUpdatedDate(new Date().toISOString().split("T")[0]);
      queryClient.invalidateQueries({ queryKey: ["/api/gists", slug] });
      if (variables?.silent) {
        setAutoSaveStatus("saved");
        setTimeout(() => setAutoSaveStatus("idle"), 2000);
      } else {
        toast({ title: "Saved", description: "Your changes have been saved." });
      }
    },
    onError: (err: any, variables) => {
      if (!variables?.silent) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
      setAutoSaveStatus("idle");
    },
  });

  const scheduleAutoSave = useCallback(() => {
    if (!slug) return;
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      if (saveGist.isPending) return;
      setAutoSaveStatus("saving");
      saveGist.mutate({ silent: true });
    }, AUTO_SAVE_DELAY);
  }, [saveGist, slug]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const handleBodyChange = useCallback((val: string) => {
    setBody(val);
    setHasChanges(true);
    scheduleAutoSave();
  }, [scheduleAutoSave]);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    setHasChanges(true);
    scheduleAutoSave();
  }, [scheduleAutoSave]);

  const replyToThread = useMutation({
    mutationFn: async ({ threadId, message }: { threadId: string; message: string }) => {
      await apiRequest("POST", `/api/g/${slug}/threads/${threadId}/reply`, { message });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/g", slug, "threads"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to post reply", variant: "destructive" });
    },
  });

  const handleThreadReply = useCallback((threadId: string, message: string) => {
    replyToThread.mutate({ threadId, message });
  }, [replyToThread]);

  const updateAccessTier = useMutation({
    mutationFn: async ({ accessTier, allowList }: { accessTier?: string; allowList?: string[] }) => {
      await apiRequest("PUT", `/api/gists/${slug}`, {
        ...(accessTier && { accessTier }),
        ...(allowList && { allowList }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gists", slug, "edit"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteGist = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/gists/${slug}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gists"] });
      navigate("/dashboard");
    },
  });

  const handleInsert = useCallback((insertMd: string) => {
    const trimmed = insertMd.trim();
    setBody((prev) => {
      const prevTrimmed = prev.trim();
      if (!prevTrimmed) return trimmed + "\n";
      return trimmed + "\n\n" + prevTrimmed + "\n";
    });
    setHasChanges(true);
    scheduleAutoSave();
  }, [scheduleAutoSave]);

  const handleExport = useCallback(() => {
    const exportMd = buildFullMarkdown(title, body);
    const blob = new Blob([exportMd], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [title, body, slug]);

  if (!isAuthenticated) {
    navigate("/auth");
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "var(--canvas)" }}>
        <div className="h-14 border-b" style={{ borderColor: "var(--gist-border)" }} />
        <div className="flex-1" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--canvas)" }}>
      <header
        className="flex items-center justify-between px-4 py-2 border-b gap-2 flex-wrap"
        style={{ borderColor: "var(--gist-border)" }}
      >
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-shrink-0">
            <GistLogo size={24} />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {autoSaveStatus === "saving" && (
            <span
              className="type-meta"
              style={{ color: "var(--ink-tertiary)" }}
              data-testid="text-autosave-saving"
            >
              Saving...
            </span>
          )}
          {autoSaveStatus === "saved" && (
            <span
              className="flex items-center gap-1 type-meta"
              style={{ color: "var(--success)" }}
              data-testid="text-autosave-saved"
            >
              <Check className="w-3 h-3" />
              Saved
            </span>
          )}
          <EditorToolbar onInsert={handleInsert} />
          <div className="w-px h-6 mx-1" style={{ backgroundColor: "var(--gist-border)" }} />
          {slug && (
            <ShareLink
              slug={slug}
              accessTier={gist?.accessTier}
              allowList={(gist as any)?.allowList}
              onAccessTierChange={(tier) => updateAccessTier.mutate({ accessTier: tier })}
              onAllowListChange={(list) => updateAccessTier.mutate({ allowList: list })}
            />
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/g/${slug}`)}
            data-testid="button-preview"
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleExport}
            data-testid="button-export"
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (confirm("Delete this Gist? This cannot be undone.")) {
                deleteGist.mutate();
              }
            }}
            data-testid="button-delete"
          >
            <Trash2 className="w-4 h-4" style={{ color: "var(--gist-error)" }} />
          </Button>
          <Button
            size="sm"
            onClick={() => saveGist.mutate({ silent: false })}
            disabled={saveGist.isPending || !hasChanges}
            data-testid="button-save"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {saveGist.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </header>

      <div
        className="px-4 py-3 border-b"
        style={{ borderColor: "var(--gist-border)" }}
      >
        <input
          value={title}
          onChange={handleTitleChange}
          placeholder="Untitled"
          className="w-full bg-transparent outline-none"
          style={{
            fontSize: "28px",
            fontWeight: 600,
            lineHeight: 1.3,
            letterSpacing: "-0.02em",
            color: "var(--ink-primary)",
          }}
          data-testid="input-gist-title"
        />
        {updatedDate && (
          <p className="type-meta mt-1" data-testid="text-updated-time">
            {relativeTime(updatedDate)}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        <GistEditor
          value={body}
          onChange={handleBodyChange}
          threads={threadsData?.threads ?? []}
          onThreadReply={handleThreadReply}
          isReplying={replyToThread.isPending}
        />
      </div>
    </div>
  );
}
