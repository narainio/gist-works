import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Props {
  name: string;
  role?: string;
}

export default function ContributorBadge({ name, role }: Props) {
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="flex items-center gap-2" data-testid={`badge-contributor-${name}`}>
      <Avatar className="w-6 h-6">
        <AvatarFallback
          className="text-[10px] font-medium"
          style={{ backgroundColor: "var(--border-subtle)", color: "var(--ink-secondary)" }}
        >
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex items-center gap-1">
        <span className="text-[13px] font-medium" style={{ color: "var(--ink-primary)" }}>
          {name}
        </span>
        {role && (
          <span className="text-[12px]" style={{ color: "var(--ink-tertiary)" }}>
            · {role}
          </span>
        )}
      </div>
    </div>
  );
}
