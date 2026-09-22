import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import OtpGate from "@/components/otp-gate";
import { GistLogo } from "@/components/gist-logo";
import { queryClient } from "@/lib/queryClient";

export default function AuthPage() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--canvas)" }}>
      <header className="px-6 py-4">
        <a href="/" className="flex items-center gap-2 w-fit">
          <GistLogo size={28} />
          <span className="text-[18px] font-semibold" style={{ color: "var(--ink-primary)" }}>
            Gist
          </span>
        </a>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 pb-16">
        <OtpGate
          mode="author"
          onVerified={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
            navigate("/dashboard");
          }}
        />
      </main>
    </div>
  );
}
