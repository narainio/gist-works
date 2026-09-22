import PrimitiveBlock from "./primitive-block";
import type { DecisionBlock } from "@/lib/primitives";
import { CheckCircle2 } from "lucide-react";

interface Props {
  decision: DecisionBlock;
  defaultCollapsed?: boolean;
  isNew?: boolean;
  blockId?: string;
}

export default function PrimitiveDecision({ decision, defaultCollapsed, isNew, blockId }: Props) {
  const preview = decision.conclusion
    ? decision.conclusion.slice(0, 80)
    : decision.question?.slice(0, 80) || "";

  return (
    <PrimitiveBlock
      type="decision"
      label="Decision"
      defaultCollapsed={defaultCollapsed}
      preview={preview}
      isNew={isNew}
      blockId={blockId}
      meta={
        decision.decided && (
          <span>
            {decision.decided}
            {decision.participants.length > 0 && ` · ${decision.participants.join(", ")}`}
          </span>
        )
      }
    >
      <h4 className="text-[15px] font-semibold leading-[1.4] mb-3" style={{ color: "var(--ink-primary)" }}>
        {decision.question}
      </h4>

      {decision.options.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-medium mb-1.5 tracking-wide uppercase" style={{ color: "var(--ink-tertiary)" }}>
            Options
          </div>
          <div className="flex flex-wrap gap-1.5">
            {decision.options.map((opt, i) => (
              <span
                key={i}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[13px] ${
                  opt === decision.conclusion
                    ? "font-medium"
                    : ""
                }`}
                style={{
                  backgroundColor: opt === decision.conclusion ? "var(--accent-subtle)" : "var(--border-subtle)",
                  color: opt === decision.conclusion ? "var(--gist-accent)" : "var(--ink-secondary)",
                }}
                data-testid={`text-option-${i}`}
              >
                {opt === decision.conclusion && <CheckCircle2 className="w-3 h-3" />}
                {opt}
              </span>
            ))}
          </div>
        </div>
      )}

      {decision.evidence && (
        <div className="mb-3">
          <div className="text-xs font-medium mb-1 tracking-wide uppercase" style={{ color: "var(--ink-tertiary)" }}>
            Evidence
          </div>
          <p className="text-[15px] leading-[1.65]" style={{ color: "var(--ink-secondary)" }}>
            {decision.evidence}
          </p>
        </div>
      )}

      {decision.conclusion && (
        <div className="mb-3">
          <div className="text-xs font-medium mb-1 tracking-wide uppercase" style={{ color: "var(--ink-tertiary)" }}>
            Conclusion
          </div>
          <p className="text-[15px] leading-[1.65] font-medium" style={{ color: "var(--ink-primary)" }}>
            {decision.conclusion}
          </p>
        </div>
      )}

      {decision.rationale && (
        <div>
          <div className="text-xs font-medium mb-1 tracking-wide uppercase" style={{ color: "var(--ink-tertiary)" }}>
            Rationale
          </div>
          <p className="text-[15px] leading-[1.65]" style={{ color: "var(--ink-secondary)" }}>
            {decision.rationale}
          </p>
        </div>
      )}
    </PrimitiveBlock>
  );
}
