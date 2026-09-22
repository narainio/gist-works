import PrimitiveBlock from "./primitive-block";
import type { TimelineBlock } from "@/lib/primitives";

interface Props {
  timeline: TimelineBlock;
  defaultCollapsed?: boolean;
  isNew?: boolean;
  blockId?: string;
}

export default function PrimitiveTimeline({ timeline, defaultCollapsed, isNew, blockId }: Props) {
  const latestEntry = timeline.entries.length > 0 ? timeline.entries[0] : null;
  const preview = latestEntry
    ? `${latestEntry.date ? latestEntry.date + " · " : ""}${latestEntry.description}`.slice(0, 80)
    : "";

  return (
    <PrimitiveBlock
      type="timeline"
      label="Timeline"
      defaultCollapsed={defaultCollapsed}
      preview={preview}
      isNew={isNew}
      blockId={blockId}
      meta={
        <span>{timeline.entries.length} entries</span>
      }
    >
      <div className="space-y-2">
        {timeline.entries.map((entry, i) => (
          <div key={i} className="flex gap-3 items-start" data-testid={`text-timeline-entry-${i}`}>
            {entry.date && (
              <span
                className="type-meta flex-shrink-0 tabular-nums"
                style={{ minWidth: "90px" }}
              >
                {entry.date}
              </span>
            )}
            <span className="text-[15px] leading-[1.65]" style={{ color: "var(--ink-secondary)" }}>
              {entry.description}
            </span>
          </div>
        ))}
      </div>
    </PrimitiveBlock>
  );
}
