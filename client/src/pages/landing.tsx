import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, FileText, Scale, MessageCircle, Clock, Sparkles, Link2 } from "lucide-react";
import { GistLogo } from "@/components/gist-logo";

export default function Landing() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--canvas)" }}>
      <header className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <GistLogo size={28} />
          <span className="text-[18px] font-semibold" style={{ color: "var(--ink-primary)" }}>
            Gist
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <Link href="/dashboard">
              <Button size="sm" data-testid="button-dashboard">Dashboard</Button>
            </Link>
          ) : (
            <Link href="/auth">
              <Button size="sm" data-testid="button-sign-in">Sign in</Button>
            </Link>
          )}
        </div>
      </header>

      <main className="content-width mx-auto px-6 pt-16 pb-24">
        <div className="text-center mb-16">
          <h1
            className="mb-4"
            style={{
              fontSize: "36px",
              fontWeight: 600,
              lineHeight: 1.2,
              letterSpacing: "-0.03em",
              color: "var(--ink-primary)",
            }}
          >
            Shared context surfaces
          </h1>
          <p
            className="text-[18px] leading-[1.5] max-w-lg mx-auto mb-8"
            style={{ color: "var(--ink-secondary)" }}
          >
            Decisions, threads, and timelines in one canonical artifact.
            AI synthesis gets collaborators caught up in 90 seconds.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href={isAuthenticated ? "/dashboard" : "/auth"}>
              <Button data-testid="button-get-started">
                Get started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-16">
          {[
            {
              icon: Scale,
              title: "Structured Decisions",
              description: "Question, options, evidence, conclusion, rationale — all in one block. Never lose the why.",
              color: "var(--ink-secondary)",
            },
            {
              icon: MessageCircle,
              title: "Native Threads",
              description: "Discussions attached to your artifact. Contributors join with just an email — no account needed.",
              color: "var(--ink-secondary)",
            },
            {
              icon: Clock,
              title: "Auto Timeline",
              description: "Every decision, thread, and edit is logged automatically. Always know what happened and when.",
              color: "var(--ink-secondary)",
            },
            {
              icon: Sparkles,
              title: "AI Synthesis",
              description: "One click and collaborators get caught up. Executive summary, full context, decisions only — you choose.",
              color: "var(--ink-secondary)",
            },
            {
              icon: Link2,
              title: "Zero Identity Tax",
              description: "Share a link. That's it. No accounts, no installs, no friction. Collaborators just open and read.",
              color: "var(--ink-secondary)",
            },
            {
              icon: FileText,
              title: "Markdown First",
              description: "Every Gist is a .md file. Export it, open it in VS Code, read it on GitHub. Your content is never locked in.",
              color: "var(--ink-secondary)",
            },
          ].map((feature, i) => (
            <div
              key={i}
              className="p-5 rounded-structural shadow-subtle hover:shadow-medium transition-shadow duration-150"
              style={{ backgroundColor: "var(--canvas-raised)" }}
            >
              <feature.icon
                className="w-5 h-5 mb-3"
                style={{ color: feature.color }}
              />
              <h3
                className="text-[15px] font-semibold mb-1.5"
                style={{ color: "var(--ink-primary)" }}
              >
                {feature.title}
              </h3>
              <p className="type-body">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <p
            className="text-[14px] mb-2"
            style={{ color: "var(--ink-tertiary)" }}
          >
            Built for people who work across multiple organizations
          </p>
          <p
            className="text-[13px]"
            style={{ color: "var(--ink-tertiary)" }}
          >
            Fractional Execs · Independent Consultants & Advisors · Distributed Teams
          </p>
        </div>
      </main>
    </div>
  );
}
