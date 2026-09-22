import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Key, ExternalLink } from "lucide-react";
import { GistLogo } from "@/components/gist-logo";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { author, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [openrouterKey, setOpenrouterKey] = useState("");

  useEffect(() => {
    if (!isAuthenticated) navigate("/auth");
  }, [isAuthenticated, navigate]);

  const saveKey = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", "/api/settings/openrouter", { key: openrouterKey });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Saved", description: "Your OpenRouter key has been saved." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (!author) return null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--canvas)" }}>
      <header
        className="flex items-center gap-3 px-6 py-4 border-b"
        style={{ borderColor: "var(--gist-border)" }}
      >
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} data-testid="button-back-settings">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <GistLogo size={24} />
          <span className="text-[16px] font-semibold" style={{ color: "var(--ink-primary)" }}>Settings</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-6 py-8">
        <Card className="p-5 mb-6">
          <h3 className="text-[15px] font-semibold mb-1" style={{ color: "var(--ink-primary)" }}>
            Account
          </h3>
          <div className="space-y-2 mt-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px]" style={{ color: "var(--ink-secondary)" }}>Email</span>
              <span className="text-[13px] font-mono" style={{ color: "var(--ink-primary)" }}>{author.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px]" style={{ color: "var(--ink-secondary)" }}>Plan</span>
              <span className="text-[13px] font-mono capitalize" style={{ color: "var(--ink-primary)" }}>{author.plan}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px]" style={{ color: "var(--ink-secondary)" }}>Synthesis tokens</span>
              <span className="text-[13px] font-mono" style={{ color: "var(--ink-primary)" }}>{author.tokenBalance} remaining</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px]" style={{ color: "var(--ink-secondary)" }}>Gist limit</span>
              <span className="text-[13px] font-mono" style={{ color: "var(--ink-primary)" }}>
                {author.plan === "paid" ? "Unlimited" : `${author.gistLimit}`}
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <Key className="w-4 h-4" style={{ color: "var(--gist-accent)" }} />
            <h3 className="text-[15px] font-semibold" style={{ color: "var(--ink-primary)" }}>
              OpenRouter API Key
            </h3>
          </div>
          <p className="text-[13px] mb-4" style={{ color: "var(--ink-secondary)" }}>
            Add your own key for unlimited AI synthesis. Your key is encrypted at rest.
          </p>

          <div className="space-y-3">
            <div>
              <Label className="text-[13px]" style={{ color: "var(--ink-secondary)" }}>API Key</Label>
              <Input
                type="password"
                value={openrouterKey}
                onChange={(e) => setOpenrouterKey(e.target.value)}
                placeholder={author.openrouterKey ? "••••••••••••••••" : "sk-or-v1-..."}
                className="mt-1 font-mono text-[13px]"
                data-testid="input-openrouter-key"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] font-medium flex items-center gap-1"
                style={{ color: "var(--gist-accent)" }}
                data-testid="link-openrouter"
              >
                Get a key
                <ExternalLink className="w-3 h-3" />
              </a>
              <Button
                size="sm"
                onClick={() => saveKey.mutate()}
                disabled={!openrouterKey || saveKey.isPending}
                data-testid="button-save-key"
              >
                {saveKey.isPending ? "Saving..." : "Save key"}
              </Button>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
