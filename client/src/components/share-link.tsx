import { useState, useEffect } from "react";
import { Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface Props {
  slug: string;
  accessTier?: string;
  allowList?: string[];
  onAccessTierChange?: (tier: string) => void;
  onAllowListChange?: (list: string[]) => void;
}

export default function ShareLink({ slug, accessTier = "open", allowList, onAccessTierChange, onAllowListChange }: Props) {
  const safeAllowList = allowList ?? [];
  const [copied, setCopied] = useState(false);
  const [allowListInput, setAllowListInput] = useState(safeAllowList.join(", "));
  const url = `${window.location.origin}/g/${slug}`;

  useEffect(() => {
    setAllowListInput((allowList ?? []).join(", "));
  }, [JSON.stringify(allowList)]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleAllowListBlur = () => {
    if (!onAllowListChange) return;
    const parsed = allowListInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    onAllowListChange(parsed);
  };

  return (
    <div className="flex flex-col gap-2" data-testid="share-link">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          data-testid="button-copy-link"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 mr-1.5" style={{ color: "var(--success)" }} />
              <span style={{ color: "var(--success)" }}>Copied</span>
            </>
          ) : (
            <>
              <Link2 className="w-3.5 h-3.5 mr-1.5" />
              <span>Copy link</span>
            </>
          )}
        </Button>
        {onAccessTierChange ? (
          <Select
            value={accessTier}
            onValueChange={(value) => onAccessTierChange(value)}
          >
            <SelectTrigger
              className="h-8 text-[12px] font-mono border-0 bg-transparent w-auto gap-1.5"
              style={{ color: "var(--ink-tertiary)" }}
              data-testid="select-access-tier"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open" data-testid="option-open">Anyone with link</SelectItem>
              <SelectItem value="verified" data-testid="option-verified">Email verified</SelectItem>
              <SelectItem value="restricted" data-testid="option-restricted">Restricted access</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <span className="text-[12px] font-mono" style={{ color: "var(--ink-tertiary)" }}>
            {accessTier === "open" ? "Anyone with link" : accessTier === "verified" ? "Email verified" : "Restricted access"}
          </span>
        )}
      </div>
      {accessTier === "restricted" && onAllowListChange && (
        <div className="flex items-center gap-2">
          <Input
            value={allowListInput}
            onChange={(e) => setAllowListInput(e.target.value)}
            onBlur={handleAllowListBlur}
            placeholder="Allowed emails or domains, comma-separated"
            className="h-8 text-[12px] font-mono"
            data-testid="input-allow-list"
          />
        </div>
      )}
    </div>
  );
}
