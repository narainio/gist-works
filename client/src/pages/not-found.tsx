import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ backgroundColor: "var(--canvas)" }}>
      <div
        className="w-16 h-16 rounded-full mb-6 flex items-center justify-center"
        style={{ backgroundColor: "var(--border-subtle)" }}
      >
        <FileText className="w-7 h-7" style={{ color: "var(--ink-tertiary)" }} />
      </div>
      <h1
        className="text-[22px] font-semibold mb-2"
        style={{ color: "var(--ink-primary)" }}
        data-testid="text-404-title"
      >
        Page not found
      </h1>
      <p
        className="text-[14px] mb-6"
        style={{ color: "var(--ink-secondary)" }}
      >
        The page you're looking for doesn't exist.
      </p>
      <Link href="/">
        <Button variant="outline" data-testid="button-back-home">Go home</Button>
      </Link>
    </div>
  );
}
