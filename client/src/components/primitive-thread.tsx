import { useState } from "react";
import PrimitiveBlock from "./primitive-block";
import type { ThreadBlock } from "@/lib/primitives";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Lock } from "lucide-react";

interface Props {
  thread: ThreadBlock;
  threadId?: string;
  defaultCollapsed?: boolean;
  onReply?: (threadId: string, message: string) => void;
  canContribute?: boolean;
  isReplying?: boolean;
  onRequestVerify?: (threadId?: string) => void;
  isNew?: boolean;
}

export default function PrimitiveThread({ thread, threadId, defaultCollapsed, onReply, canContribute, isReplying, onRequestVerify, isNew }: Props) {
  const [replyText, setReplyText] = useState("");

  const handleSubmitReply = () => {
    if (!replyText.trim() || !threadId) return;
    if (!canContribute && onRequestVerify) {
      onRequestVerify(threadId);
      return;
    }
    if (!onReply) return;
    onReply(threadId, replyText.trim());
    setReplyText("");
  };

  const handleReplyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitReply();
    }
  };

  const latestMsg = thread.messages.length > 0
    ? thread.messages[thread.messages.length - 1]
    : null;
  const preview = latestMsg
    ? `${latestMsg.authorName}: ${latestMsg.body}`.slice(0, 80)
    : "";

  return (
    <PrimitiveBlock
      type="thread"
      label="Thread"
      defaultCollapsed={defaultCollapsed}
      preview={preview}
      isNew={isNew}
      meta={
        <span className="flex items-center gap-2 flex-wrap">
          {thread.source && <span>{thread.source}</span>}
          {thread.date && <span>· {thread.date}</span>}
          {thread.messages.length > 0 && (
            <span>· {thread.messages.length} {thread.messages.length === 1 ? "message" : "messages"}</span>
          )}
        </span>
      }
    >
      <div className="space-y-3">
        {thread.messages.map((msg, i) => (
          <div key={i} className="flex gap-3" data-testid={`text-message-${i}`}>
            <Avatar className="w-7 h-7 flex-shrink-0 mt-0.5">
              <AvatarFallback
                className="text-[11px] font-medium"
                style={{ backgroundColor: "var(--border-subtle)", color: "var(--ink-secondary)" }}
              >
                {msg.authorName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <span className="text-[13px] font-medium" style={{ color: "var(--ink-primary)" }}>
                {msg.authorName}
              </span>
              <p className="text-[15px] leading-[1.65] mt-0.5" style={{ color: "var(--ink-secondary)" }}>
                {msg.body}
              </p>
            </div>
          </div>
        ))}
      </div>

      {threadId && (onReply || onRequestVerify) && (
        <div className="mt-3">
          <div className="flex gap-2">
            <Input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={handleReplyKeyDown}
              placeholder="Write a reply..."
              className="flex-1 text-[14px]"
              data-testid="input-thread-reply"
            />
            <Button
              size="icon"
              onClick={handleSubmitReply}
              disabled={!replyText.trim() || isReplying}
              data-testid="button-submit-reply"
              title={canContribute ? "Send reply" : "Verify email to reply"}
            >
              {canContribute ? (
                <Send className="w-3.5 h-3.5" />
              ) : (
                <Lock className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
          {!canContribute && replyText.trim() && (
            <p className="text-[12px] mt-1.5" style={{ color: "var(--ink-tertiary)" }}>
              Verify your email to post this reply
            </p>
          )}
        </div>
      )}
    </PrimitiveBlock>
  );
}
