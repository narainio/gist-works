import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import MarkdownRenderer from "@/components/markdown-renderer";
import SynthesisPanel from "@/components/synthesis-panel";
import OtpGate from "@/components/otp-gate";
import MetaLine from "@/components/meta-line";
import ContributorBadge from "@/components/contributor-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Download, Lock, AlertCircle, Send, ArrowLeft } from "lucide-react";
import { GistLogo } from "@/components/gist-logo";
import type { Gist, Contributor, TimelineEntry, Thread } from "@shared/schema";
import { parseGistMarkdown } from "@/lib/primitives";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface GistViewData extends Gist {
  contributors?: Contributor[];
  timelineEntries?: TimelineEntry[];
  threads?: Thread[];
}

type PendingAction =
  | { type: "new-thread"; anchorBlockIndex?: number }
  | { type: "reply"; threadId: string };

function getLastVisited(slug: string): Date | null {
  try {
    const raw = localStorage.getItem(`gist-lastVisited-${slug}`);
    if (raw) {
      const d = new Date(raw);
      return isNaN(d.getTime()) ? null : d;
    }
  } catch {}
  return null;
}

function setLastVisited(slug: string) {
  try {
    localStorage.setItem(`gist-lastVisited-${slug}`, new Date().toISOString());
  } catch {}
}

export default function ViewerPage() {
  const { slug } = useParams<{ slug: string }>();
  const { isAuthenticated, author } = useAuth();
  const [contributorVerified, setContributorVerified] = useState(false);
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [modalStep, setModalStep] = useState<"verify" | "compose">("verify");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [threadMessage, setThreadMessage] = useState("");
  const composeInputRef = useRef<HTMLTextAreaElement>(null);
  const [lastVisited] = useState<Date | null>(() => slug ? getLastVisited(slug) : null);

  useEffect(() => {
    if (slug) {
      const timer = setTimeout(() => setLastVisited(slug), 3000);
      return () => clearTimeout(timer);
    }
  }, [slug]);

  const { data: gist, isLoading, error } = useQuery<GistViewData>({
    queryKey: ["/api/g", slug],
    enabled: !!slug,
  });

  const { data: contributorStatus } = useQuery<{ verified: boolean }>({
    queryKey: ["/api/g", slug, "contributor-status"],
    queryFn: async () => {
      const res = await fetch(`/api/g/${slug}/contributor-status`, { credentials: "include" });
      if (!res.ok) return { verified: false };
      return res.json();
    },
    enabled: !!slug,
  });

  useEffect(() => {
    if (contributorStatus?.verified) {
      setContributorVerified(true);
    }
  }, [contributorStatus]);

  const isAuthor = isAuthenticated && !!gist && !!author && author.id === gist.authorId;
  const canInteract = contributorVerified || isAuthor;

  const [needsVerification, setNeedsVerification] = useState(false);

  const { toast } = useToast();

  const addThreadMessage = useMutation({
    mutationFn: async ({ message, anchorBlockIndex }: { message: string; anchorBlockIndex?: number }) => {
      await apiRequest("POST", `/api/g/${slug}/threads`, { message, anchorBlockIndex });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/g", slug] });
      setShowContributeModal(false);
      setThreadMessage("");
      setPendingAction(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to start thread", variant: "destructive" });
    },
  });

  const replyToThread = useMutation({
    mutationFn: async ({ threadId, message }: { threadId: string; message: string }) => {
      await apiRequest("POST", `/api/g/${slug}/threads/${threadId}/reply`, { message });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/g", slug] });
      setShowContributeModal(false);
      setThreadMessage("");
      setPendingAction(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to post reply", variant: "destructive" });
    },
  });

  const handleThreadReply = useCallback((threadId: string, message: string) => {
    if (canInteract) {
      replyToThread.mutate({ threadId, message });
    } else {
      setPendingAction({ type: "reply", threadId });
      setModalStep("verify");
      setThreadMessage(message);
      setShowContributeModal(true);
    }
  }, [canInteract, replyToThread]);

  const handleAddThreadMessage = useCallback(() => {
    if (canInteract) {
      setPendingAction({ type: "new-thread" });
      setModalStep("compose");
      setThreadMessage("");
      setShowContributeModal(true);
    } else {
      setPendingAction({ type: "new-thread" });
      setModalStep("verify");
      setThreadMessage("");
      setShowContributeModal(true);
    }
  }, [canInteract]);

  const handleRequestVerify = useCallback((threadId?: string) => {
    if (threadId) {
      setPendingAction({ type: "reply", threadId });
    } else {
      setPendingAction({ type: "new-thread" });
    }
    setModalStep("verify");
    setThreadMessage("");
    setShowContributeModal(true);
  }, []);

  const handleOtpVerified = useCallback(() => {
    setContributorVerified(true);
    setModalStep("compose");
    setTimeout(() => composeInputRef.current?.focus(), 100);
  }, []);

  const handleComposeSubmit = useCallback(() => {
    if (!threadMessage.trim()) return;
    if (pendingAction?.type === "reply") {
      replyToThread.mutate({ threadId: pendingAction.threadId, message: threadMessage.trim() });
    } else {
      addThreadMessage.mutate({
        message: threadMessage.trim(),
        anchorBlockIndex: pendingAction?.type === "new-thread" ? pendingAction.anchorBlockIndex : undefined,
      });
    }
  }, [threadMessage, pendingAction, replyToThread, addThreadMessage]);

  const handleStartThreadAtBlock = useCallback((blockIndex: number) => {
    if (canInteract) {
      setPendingAction({ type: "new-thread", anchorBlockIndex: blockIndex });
      setModalStep("compose");
      setThreadMessage("");
      setShowContributeModal(true);
    } else {
      setPendingAction({ type: "new-thread", anchorBlockIndex: blockIndex });
      setModalStep("verify");
      setThreadMessage("");
      setShowContributeModal(true);
    }
  }, [canInteract]);

  const handleModalClose = useCallback((open: boolean) => {
    if (!open) {
      setShowContributeModal(false);
      setThreadMessage("");
      setPendingAction(null);
      setModalStep("verify");
    }
  }, []);

  const handleExport = useCallback(() => {
    if (!gist) return;
    const blob = new Blob([gist.markdownSource], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [gist, slug]);

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "var(--canvas)" }} />
    );
  }

  if (error) {
    const errMsg = (error as any)?.message || "";
    if (errMsg.includes("401") || errMsg.includes("403")) {
      if (!needsVerification) setNeedsVerification(true);
      return (
        <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--canvas)" }}>
          <header className="px-6 py-4">
            <a href="/" className="flex items-center gap-2 w-fit">
              <GistLogo size={28} />
              <span className="text-[18px] font-semibold" style={{ color: "var(--ink-primary)" }}>Gist</span>
            </a>
          </header>
          <main className="flex-1 flex items-center justify-center px-6 pb-16">
            {needsVerification && !contributorVerified ? (
              <div className="w-full max-w-sm">
                <div className="text-center mb-6">
                  <Lock className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--ink-tertiary)" }} />
                  <p className="text-[14px]" style={{ color: "var(--ink-secondary)" }}>
                    This Gist requires verification to access.
                  </p>
                </div>
                <OtpGate
                  mode="contributor"
                  slug={slug}
                  onVerified={() => {
                    setContributorVerified(true);
                    setNeedsVerification(false);
                    queryClient.invalidateQueries({ queryKey: ["/api/g", slug] });
                  }}
                />
              </div>
            ) : (
              <div className="text-center">
                <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--ink-tertiary)" }} />
                <p className="text-[15px] mb-1" style={{ color: "var(--ink-primary)" }}>
                  This Gist doesn't exist or has been removed
                </p>
                <p className="text-[14px]" style={{ color: "var(--ink-secondary)" }}>
                  Check the link and try again.
                </p>
              </div>
            )}
          </main>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--canvas)" }}>
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--ink-tertiary)" }} />
          <p className="text-[15px]" style={{ color: "var(--ink-primary)" }}>
            This Gist doesn't exist or has been removed.
          </p>
        </div>
      </div>
    );
  }

  if (!gist) return null;

  const parsed = parseGistMarkdown(gist.markdownSource);
  const updatedLabel = gist.updatedAt
    ? formatDistanceToNow(new Date(gist.updatedAt), { addSuffix: true })
    : "";

  const modalTitle = modalStep === "verify"
    ? "Verify to contribute"
    : pendingAction?.type === "reply"
      ? "Reply to thread"
      : "Start a new thread";

  const modalDescription = modalStep === "verify"
    ? "Enter your email and name to join the conversation."
    : pendingAction?.type === "reply"
      ? "Your reply will be added to this thread."
      : "Your message will start a new discussion thread.";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--canvas)" }}>
      <header
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: "var(--gist-border)" }}
      >
        <div className="flex items-center gap-3">
          {isAuthor && (
            <Link href={`/edit/${slug}`} data-testid="link-back-to-editor">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
          )}
          <a href="/" className="flex items-center gap-2">
            <GistLogo size={28} />
            <span className="text-[18px] font-semibold" style={{ color: "var(--ink-primary)" }}>Gist</span>
          </a>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          data-testid="button-export-viewer"
        >
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Export .md
        </Button>
      </header>

      <main className="content-width mx-auto px-6 py-8">
        <div className="mb-8">
          <h1
            className="type-h1 mb-2"
            data-testid="text-gist-title"
          >
            {parsed.frontmatter.title || gist.title}
          </h1>
          <MetaLine
            items={[
              updatedLabel && `Updated ${updatedLabel}`,
              parsed.frontmatter.contributors?.length
                ? `${parsed.frontmatter.contributors.length} contributors`
                : null,
            ]}
          />
        </div>

        <SynthesisPanel slug={slug!} />

        <MarkdownRenderer
          markdown={gist.markdownSource}
          canContribute={!!canInteract}
          onAddThreadMessage={handleAddThreadMessage}
          threads={gist.threads}
          onThreadReply={handleThreadReply}
          isReplying={replyToThread.isPending}
          onRequestVerify={handleRequestVerify}
          onStartThreadAtBlock={handleStartThreadAtBlock}
          lastVisited={lastVisited}
        />

        {gist.contributors && gist.contributors.length > 0 && (
          <div className="mt-12 pt-8 border-t" style={{ borderColor: "var(--gist-border)" }}>
            <h3 className="primitive-label mb-3" style={{ color: "var(--ink-tertiary)" }}>
              Contributors
            </h3>
            <div className="space-y-2">
              {gist.contributors.map((c) => (
                <ContributorBadge key={c.id} name={c.displayName} />
              ))}
            </div>
          </div>
        )}
      </main>

      <Dialog open={showContributeModal} onOpenChange={handleModalClose}>
        <DialogContent style={{ backgroundColor: "var(--canvas-raised)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--ink-primary)" }}>{modalTitle}</DialogTitle>
            <DialogDescription style={{ color: "var(--ink-secondary)" }}>
              {modalDescription}
            </DialogDescription>
          </DialogHeader>

          {modalStep === "verify" ? (
            <OtpGate
              mode="contributor"
              slug={slug}
              onVerified={handleOtpVerified}
            />
          ) : (
            <div className="space-y-3">
              <Textarea
                ref={composeInputRef}
                value={threadMessage}
                onChange={(e) => setThreadMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleComposeSubmit();
                  }
                }}
                placeholder={pendingAction?.type === "reply" ? "Write your reply..." : "What would you like to discuss?"}
                className="resize-none"
                rows={4}
                autoFocus
                data-testid="input-thread-contribution"
              />
              <Button
                className="w-full"
                onClick={handleComposeSubmit}
                disabled={!threadMessage.trim() || addThreadMessage.isPending || replyToThread.isPending}
                data-testid="button-submit-contribution"
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                {addThreadMessage.isPending || replyToThread.isPending
                  ? "Posting..."
                  : pendingAction?.type === "reply"
                    ? "Post reply"
                    : "Start thread"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
