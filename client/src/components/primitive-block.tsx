import { useState } from "react";
import { ChevronRight } from "lucide-react";

type PrimitiveType = "decision" | "thread" | "timeline" | "snapshot";

interface PrimitiveBlockProps {
  type: PrimitiveType;
  label: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  preview?: string;
  isNew?: boolean;
  children: React.ReactNode;
  meta?: React.ReactNode;
}

const borderColors: Record<PrimitiveType, string> = {
  decision: "var(--primitive-decision)",
  thread: "var(--primitive-thread)",
  timeline: "var(--primitive-timeline)",
  snapshot: "var(--primitive-snapshot)",
};

const labelColors: Record<PrimitiveType, string> = {
  decision: "var(--primitive-decision)",
  thread: "var(--primitive-thread)",
  timeline: "var(--primitive-timeline)",
  snapshot: "var(--primitive-snapshot)",
};

interface PrimitiveBlockPropsInternal extends PrimitiveBlockProps {
  blockId?: string;
}

export default function PrimitiveBlock({
  type,
  label,
  collapsible = true,
  defaultCollapsed = true,
  preview,
  isNew,
  blockId,
  children,
  meta,
}: PrimitiveBlockPropsInternal) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div
      className="mb-6 border-l-[3px] pl-4 py-3"
      style={{
        borderLeftColor: borderColors[type],
      }}
      data-testid={`primitive-${type}`}
    >
      <div
        className="flex items-center gap-2 cursor-pointer select-none mb-2"
        onClick={() => collapsible && setCollapsed(!collapsed)}
        data-testid={`button-toggle-${type}`}
        data-block-toggle={blockId || ""}
        role={collapsible ? "button" : undefined}
        tabIndex={collapsible ? 0 : undefined}
        onKeyDown={(e) => {
          if (collapsible && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setCollapsed(!collapsed);
          }
        }}
      >
        {collapsible && (
          <ChevronRight
            className="w-3.5 h-3.5 transition-transform duration-100 ease-out flex-shrink-0"
            style={{
              color: labelColors[type],
              transform: collapsed ? "rotate(0deg)" : "rotate(90deg)",
            }}
          />
        )}
        <span
          className="primitive-label"
          style={{ color: labelColors[type] }}
        >
          {label}
        </span>
        {isNew && (
          <span
            className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{
              color: "var(--gist-accent)",
              backgroundColor: "var(--accent-subtle)",
            }}
            data-testid="badge-new"
          >
            New
          </span>
        )}
        {collapsed && preview && (
          <span
            className="text-[13px] truncate ml-1 flex-1"
            style={{ color: "var(--ink-tertiary)" }}
          >
            {preview}
          </span>
        )}
      </div>

      {!collapsed && (
        <div>
          {children}
          {meta && (
            <div className="mt-3 type-meta">
              {meta}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
