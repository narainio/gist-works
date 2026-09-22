import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useAuthorGists } from "@/hooks/use-gist";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import GistCard from "@/components/gist-card";
import { Plus, FileText, LogOut, Settings, AlertCircle } from "lucide-react";
import { GistLogo } from "@/components/gist-logo";

export default function Dashboard() {
  const { author, logout } = useAuth();
  const { data: gists, isLoading } = useAuthorGists();
  const [, navigate] = useLocation();

  const createGist = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/gists", {
        title: "Untitled Gist",
        markdownSource: "---\ntitle: Untitled Gist\ncreated: " + new Date().toISOString().split("T")[0] + "\n---\n\n",
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/gists"] });
      navigate(`/edit/${data.slug}`);
    },
  });

  const activeGists = gists?.filter((g) => g.isActive) || [];
  const gistLimit = author?.gistLimit ?? 1;
  const atLimit = activeGists.length >= gistLimit && author?.plan === "free";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--canvas)" }}>
      <header
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: "var(--gist-border)" }}
      >
        <a href="/" className="flex items-center gap-2">
          <GistLogo size={28} />
          <span className="text-[18px] font-semibold" style={{ color: "var(--ink-primary)" }}>
            Gist
          </span>
        </a>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/settings")}
            data-testid="button-settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              logout.mutate();
              navigate("/");
            }}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1
              className="text-[22px] font-semibold leading-[1.35] tracking-[-0.01em]"
              style={{ color: "var(--ink-primary)" }}
            >
              Your Gists
            </h1>
            {author && (
              <p className="text-[13px] mt-1" style={{ color: "var(--ink-tertiary)" }}>
                {author.email}
                <span className="mx-1">·</span>
                {author.tokenBalance} synthesis tokens remaining
              </p>
            )}
          </div>
          <Button
            onClick={() => createGist.mutate()}
            disabled={createGist.isPending || atLimit}
            data-testid="button-new-gist"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Gist
          </Button>
        </div>

        {atLimit && (
          <div
            className="flex items-start gap-3 p-4 rounded-structural mb-6"
            style={{
              backgroundColor: "var(--accent-subtle)",
              border: "1px solid var(--gist-border)",
            }}
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "var(--gist-accent)" }} />
            <div>
              <p className="text-[14px] font-medium" style={{ color: "var(--ink-primary)" }}>
                You've reached your free Gist limit
              </p>
              <p className="text-[13px] mt-0.5" style={{ color: "var(--ink-secondary)" }}>
                Upgrade to create more Gists. Your existing Gist remains fully functional.
              </p>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 rounded-structural"
                style={{ backgroundColor: "var(--border-subtle)" }}
              />
            ))}
          </div>
        ) : activeGists.length === 0 ? (
          <div className="text-center py-16">
            <div
              className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: "var(--border-subtle)" }}
            >
              <FileText className="w-7 h-7" style={{ color: "var(--ink-tertiary)" }} />
            </div>
            <p className="text-[15px] mb-1" style={{ color: "var(--ink-primary)" }}>
              No Gists yet
            </p>
            <p className="text-[14px] mb-6" style={{ color: "var(--ink-secondary)" }}>
              Create your first shared context surface
            </p>
            <Button onClick={() => createGist.mutate()} disabled={createGist.isPending} data-testid="button-create-first">
              <Plus className="w-4 h-4 mr-1.5" />
              Create your first Gist
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {activeGists.map((gist) => (
              <GistCard key={gist.id} gist={gist} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
