interface Props {
  items: (string | undefined | null)[];
}

export default function MetaLine({ items }: Props) {
  const filtered = items.filter(Boolean) as string[];
  return (
    <div
      className="font-mono text-[13px] leading-[1.6] flex flex-wrap items-center gap-1"
      style={{ color: "var(--ink-tertiary)" }}
      data-testid="text-meta-line"
    >
      {filtered.map((item, i) => (
        <span key={i}>
          {i > 0 && <span className="mx-1">·</span>}
          {item}
        </span>
      ))}
    </div>
  );
}
