import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Scale, MessageCircle, Clock, Plus } from "lucide-react";
import { generateDecisionMarkdown, generateThreadMarkdown, prependBlock } from "@/lib/primitives";

const EDITOR_MOBILE_BREAKPOINT = 640;

function useIsEditorMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${EDITOR_MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(window.innerWidth < EDITOR_MOBILE_BREAKPOINT);
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < EDITOR_MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}

interface Props {
  onInsert: (markdown: string) => void;
}

export default function EditorToolbar({ onInsert }: Props) {
  const isMobile = useIsEditorMobile();
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [threadOpen, setThreadOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const [decisionForm, setDecisionForm] = useState({
    question: "",
    options: "",
    evidence: "",
    conclusion: "",
    rationale: "",
    date: new Date().toISOString().split("T")[0],
    participants: "",
  });

  const [threadForm, setThreadForm] = useState({
    source: "Native",
    authorName: "",
    message: "",
  });

  const [timelineForm, setTimelineForm] = useState({
    date: new Date().toISOString().split("T")[0],
    description: "",
  });

  const handleDecisionSubmit = () => {
    const md = generateDecisionMarkdown({
      question: decisionForm.question,
      options: decisionForm.options.split(",").map((o) => o.trim()).filter(Boolean),
      evidence: decisionForm.evidence,
      conclusion: decisionForm.conclusion,
      rationale: decisionForm.rationale,
      date: decisionForm.date,
      participants: decisionForm.participants.split(",").map((p) => p.trim()).filter(Boolean),
    });
    onInsert("\n\n" + md + "\n\n");
    setDecisionOpen(false);
    setDecisionForm({
      question: "", options: "", evidence: "", conclusion: "", rationale: "",
      date: new Date().toISOString().split("T")[0], participants: "",
    });
  };

  const handleThreadSubmit = () => {
    const md = generateThreadMarkdown({
      source: threadForm.source,
      date: new Date().toISOString().split("T")[0],
      messages: [{ authorName: threadForm.authorName, body: threadForm.message }],
    });
    onInsert("\n\n" + md + "\n\n");
    setThreadOpen(false);
    setThreadForm({ source: "Native", authorName: "", message: "" });
  };

  const handleTimelineSubmit = () => {
    onInsert(`\n\n> **Timeline:**\n> - ${timelineForm.date} · ${timelineForm.description}\n\n`);
    setTimelineOpen(false);
    setTimelineForm({ date: new Date().toISOString().split("T")[0], description: "" });
  };

  return (
    <>
      {isMobile ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" data-testid="button-add-menu">
              <Plus className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" style={{ backgroundColor: "var(--canvas-raised)" }}>
            <DropdownMenuItem onClick={() => setDecisionOpen(true)} data-testid="button-add-decision">
              <Scale className="w-3.5 h-3.5 mr-2" />
              Add Decision
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setThreadOpen(true)} data-testid="button-add-thread">
              <MessageCircle className="w-3.5 h-3.5 mr-2" />
              Add Thread
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTimelineOpen(true)} data-testid="button-add-timeline">
              <Clock className="w-3.5 h-3.5 mr-2" />
              Add Timeline
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex items-center gap-1.5 flex-wrap" data-testid="editor-toolbar">
          <Button variant="outline" size="sm" onClick={() => setDecisionOpen(true)} data-testid="button-add-decision">
            <Scale className="w-3.5 h-3.5 mr-1.5" />
            Add Decision
          </Button>
          <Button variant="outline" size="sm" onClick={() => setThreadOpen(true)} data-testid="button-add-thread">
            <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
            Add Thread
          </Button>
          <Button variant="outline" size="sm" onClick={() => setTimelineOpen(true)} data-testid="button-add-timeline">
            <Clock className="w-3.5 h-3.5 mr-1.5" />
            Add Timeline
          </Button>
        </div>
      )}

      <Dialog open={decisionOpen} onOpenChange={setDecisionOpen}>
        <DialogContent className="max-w-lg" style={{ backgroundColor: "var(--canvas-raised)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--ink-primary)" }}>Add Decision</DialogTitle>
            <DialogDescription style={{ color: "var(--ink-secondary)" }}>
              Record a structured decision with context and rationale.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-[13px]" style={{ color: "var(--ink-secondary)" }}>Question</Label>
              <Input
                value={decisionForm.question}
                onChange={(e) => setDecisionForm((p) => ({ ...p, question: e.target.value }))}
                placeholder="What decision was made?"
                className="mt-1"
                data-testid="input-decision-question"
              />
            </div>
            <div>
              <Label className="text-[13px]" style={{ color: "var(--ink-secondary)" }}>Options (comma-separated)</Label>
              <Input
                value={decisionForm.options}
                onChange={(e) => setDecisionForm((p) => ({ ...p, options: e.target.value }))}
                placeholder="Option A, Option B, Option C"
                className="mt-1"
                data-testid="input-decision-options"
              />
            </div>
            <div>
              <Label className="text-[13px]" style={{ color: "var(--ink-secondary)" }}>Evidence</Label>
              <Textarea
                value={decisionForm.evidence}
                onChange={(e) => setDecisionForm((p) => ({ ...p, evidence: e.target.value }))}
                placeholder="What evidence informed this decision?"
                className="mt-1 resize-none"
                rows={2}
                data-testid="input-decision-evidence"
              />
            </div>
            <div>
              <Label className="text-[13px]" style={{ color: "var(--ink-secondary)" }}>Conclusion</Label>
              <Input
                value={decisionForm.conclusion}
                onChange={(e) => setDecisionForm((p) => ({ ...p, conclusion: e.target.value }))}
                placeholder="What was decided?"
                className="mt-1"
                data-testid="input-decision-conclusion"
              />
            </div>
            <div>
              <Label className="text-[13px]" style={{ color: "var(--ink-secondary)" }}>Rationale</Label>
              <Textarea
                value={decisionForm.rationale}
                onChange={(e) => setDecisionForm((p) => ({ ...p, rationale: e.target.value }))}
                placeholder="Why was this decided?"
                className="mt-1 resize-none"
                rows={2}
                data-testid="input-decision-rationale"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label className="text-[13px]" style={{ color: "var(--ink-secondary)" }}>Date</Label>
                <Input
                  type="date"
                  value={decisionForm.date}
                  onChange={(e) => setDecisionForm((p) => ({ ...p, date: e.target.value }))}
                  className="mt-1"
                  data-testid="input-decision-date"
                />
              </div>
              <div className="flex-1">
                <Label className="text-[13px]" style={{ color: "var(--ink-secondary)" }}>Participants (comma-separated)</Label>
                <Input
                  value={decisionForm.participants}
                  onChange={(e) => setDecisionForm((p) => ({ ...p, participants: e.target.value }))}
                  placeholder="Alice, Bob"
                  className="mt-1"
                  data-testid="input-decision-participants"
                />
              </div>
            </div>
            <Button
              className="w-full"
              onClick={handleDecisionSubmit}
              disabled={!decisionForm.question || !decisionForm.conclusion}
              data-testid="button-submit-decision"
            >
              Insert Decision
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={threadOpen} onOpenChange={setThreadOpen}>
        <DialogContent className="max-w-lg" style={{ backgroundColor: "var(--canvas-raised)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--ink-primary)" }}>Start Thread</DialogTitle>
            <DialogDescription style={{ color: "var(--ink-secondary)" }}>
              Start a native discussion thread.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-[13px]" style={{ color: "var(--ink-secondary)" }}>Your name</Label>
              <Input
                value={threadForm.authorName}
                onChange={(e) => setThreadForm((p) => ({ ...p, authorName: e.target.value }))}
                placeholder="Your name"
                className="mt-1"
                data-testid="input-thread-author"
              />
            </div>
            <div>
              <Label className="text-[13px]" style={{ color: "var(--ink-secondary)" }}>Message</Label>
              <Textarea
                value={threadForm.message}
                onChange={(e) => setThreadForm((p) => ({ ...p, message: e.target.value }))}
                placeholder="Start the conversation..."
                className="mt-1 resize-none"
                rows={3}
                data-testid="input-thread-message"
              />
            </div>
            <Button
              className="w-full"
              onClick={handleThreadSubmit}
              disabled={!threadForm.authorName || !threadForm.message}
              data-testid="button-submit-thread"
            >
              Insert Thread
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={timelineOpen} onOpenChange={setTimelineOpen}>
        <DialogContent className="max-w-lg" style={{ backgroundColor: "var(--canvas-raised)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--ink-primary)" }}>Add Timeline Entry</DialogTitle>
            <DialogDescription style={{ color: "var(--ink-secondary)" }}>
              Add a manual entry to the timeline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-[13px]" style={{ color: "var(--ink-secondary)" }}>Date</Label>
              <Input
                type="date"
                value={timelineForm.date}
                onChange={(e) => setTimelineForm((p) => ({ ...p, date: e.target.value }))}
                className="mt-1"
                data-testid="input-timeline-date"
              />
            </div>
            <div>
              <Label className="text-[13px]" style={{ color: "var(--ink-secondary)" }}>Description</Label>
              <Input
                value={timelineForm.description}
                onChange={(e) => setTimelineForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="What happened?"
                className="mt-1"
                data-testid="input-timeline-description"
              />
            </div>
            <Button
              className="w-full"
              onClick={handleTimelineSubmit}
              disabled={!timelineForm.description}
              data-testid="button-submit-timeline"
            >
              Insert Timeline Entry
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
