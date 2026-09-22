import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { FileText, Users, Clock } from "lucide-react";
import type { Gist } from "@shared/schema";
import MetaLine from "./meta-line";
import { formatDistanceToNow } from "date-fns";

interface Props {
  gist: Gist;
}

export default function GistCard({ gist }: Props) {
  const updatedLabel = gist.updatedAt
    ? formatDistanceToNow(new Date(gist.updatedAt), { addSuffix: true })
    : "";

  return (
    <Link href={`/edit/${gist.slug}`}>
      <Card
        className="p-4 hover-elevate cursor-pointer"
        data-testid={`card-gist-${gist.slug}`}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ backgroundColor: "var(--accent-subtle)" }}
          >
            <FileText className="w-4 h-4" style={{ color: "var(--gist-accent)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className="text-[15px] font-semibold truncate"
              style={{ color: "var(--ink-primary)" }}
              data-testid={`text-gist-title-${gist.slug}`}
            >
              {gist.title}
            </h3>
            <MetaLine
              items={[
                updatedLabel,
                gist.accessTier !== "open" ? gist.accessTier : null,
              ]}
            />
          </div>
        </div>
      </Card>
    </Link>
  );
}
