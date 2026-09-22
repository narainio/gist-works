import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowRight, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface OtpGateProps {
  mode: "author" | "contributor";
  slug?: string;
  onVerified?: (data: any) => void;
}

export default function OtpGate({ mode, slug, onVerified }: OtpGateProps) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);

  const requestOtp = async () => {
    if (loading || !email || (mode === "contributor" && !displayName)) return;
    setLoading(true);
    setError(null);
    try {
      const url = mode === "author" ? "/api/auth/request-otp" : `/api/g/${slug}/verify`;
      const body = mode === "author" ? { email } : { email, displayName };
      const res = await apiRequest("POST", url, body);
      const data = await res.json();
      if (data.devCode) {
        setDevCode(data.devCode);
      }
      setStep("code");
    } catch (err: any) {
      setError(err.message || "Failed to send code");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (loading || code.length < 6) return;
    setLoading(true);
    setError(null);
    try {
      const url = mode === "author" ? "/api/auth/verify-otp" : `/api/g/${slug}/verify/confirm`;
      const res = await apiRequest("POST", url, { email, code, displayName });
      const data = await res.json();
      onVerified?.(data);
    } catch (err: any) {
      setError(err.message || "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      requestOtp();
    }
  };

  const handleCodeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      verifyOtp();
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto" data-testid="otp-gate">
      {step === "email" ? (
        <div className="space-y-4">
          <div className="text-center mb-6">
            <div
              className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: "var(--accent-subtle)" }}
            >
              <Mail className="w-5 h-5" style={{ color: "var(--gist-accent)" }} />
            </div>
            <h3 className="text-[18px] font-semibold mb-1" style={{ color: "var(--ink-primary)" }}>
              {mode === "author" ? "Sign in to Gist" : "Verify to contribute"}
            </h3>
            <p className="text-[14px]" style={{ color: "var(--ink-secondary)" }}>
              {mode === "author"
                ? "Enter your email to receive a verification code"
                : "Enter your email and name to join the conversation"}
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="email" className="text-[13px]" style={{ color: "var(--ink-secondary)" }}>
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleEmailKeyDown}
                placeholder="you@example.com"
                className="mt-1"
                data-testid="input-email"
              />
            </div>

            {mode === "contributor" && (
              <div>
                <Label htmlFor="displayName" className="text-[13px]" style={{ color: "var(--ink-secondary)" }}>
                  Display name
                </Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onKeyDown={handleEmailKeyDown}
                  placeholder="Your name"
                  className="mt-1"
                  data-testid="input-display-name"
                />
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--gist-error)" }}>
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          <Button
            className="w-full"
            onClick={requestOtp}
            disabled={loading || !email || (mode === "contributor" && !displayName)}
            data-testid="button-request-otp"
          >
            {loading ? "Sending..." : "Send verification code"}
            {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-center mb-6">
            <h3 className="text-[18px] font-semibold mb-1" style={{ color: "var(--ink-primary)" }}>
              Check your email
            </h3>
            <p className="text-[14px]" style={{ color: "var(--ink-secondary)" }}>
              {devCode
                ? "No email service configured \u2014 use the code below"
                : <>We sent a 6-digit code to <span className="font-medium" style={{ color: "var(--ink-primary)" }}>{email}</span></>}
            </p>
          </div>

          {devCode && (
            <div
              className="rounded-md p-3 text-center"
              style={{ backgroundColor: "var(--accent-subtle)", border: "1px solid var(--gist-accent)" }}
              data-testid="dev-otp-code"
            >
              <p className="text-[11px] font-medium mb-1" style={{ color: "var(--gist-accent)" }}>
                DEV MODE
              </p>
              <span
                className="font-mono text-[24px] font-bold tracking-[0.3em]"
                style={{ color: "var(--ink-primary)" }}
              >
                {devCode}
              </span>
            </div>
          )}

          <div>
            <Label htmlFor="code" className="text-[13px]" style={{ color: "var(--ink-secondary)" }}>
              Verification code
            </Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={handleCodeKeyDown}
              placeholder="000000"
              className="mt-1 text-center text-[18px] font-mono tracking-[0.3em]"
              maxLength={6}
              data-testid="input-otp-code"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--gist-error)" }}>
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          <Button
            className="w-full"
            onClick={verifyOtp}
            disabled={loading || code.length < 6}
            data-testid="button-verify-otp"
          >
            {loading ? "Verifying..." : "Verify"}
          </Button>

          <button
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
              setDevCode(null);
            }}
            className="w-full text-center text-[13px] font-medium py-2"
            style={{ color: "var(--gist-accent)" }}
            data-testid="button-back-to-email"
          >
            Use a different email
          </button>
        </div>
      )}
    </div>
  );
}
