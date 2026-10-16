import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Flag, Ban, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

export const FLAG_REASONS = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "personal_info", label: "Shares someone's personal details" },
  { value: "threat", label: "Threat or intimidation" },
  { value: "spam", label: "Spam or scam" },
  { value: "other", label: "Something else" },
];

/** Display names for a list of author ids. Only display names are ever shown. */
export function useDisplayNames(ids: string[]) {
  const unique = [...new Set(ids)].sort();
  const { data = {} } = useQuery({
    queryKey: ["names", unique.join(",")],
    enabled: unique.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, display_name").in("id", unique);
      return Object.fromEntries((data ?? []).map((p) => [p.id, p.display_name])) as Record<string, string>;
    },
  });
  return (id: string) => data[id] ?? "Member";
}

export function timeAgo(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function ContentActions({
  authorId, postId, replyId, onDeleted,
}: { authorId: string; postId?: string; replyId?: string; onDeleted?: () => void }) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("harassment");
  const [details, setDetails] = useState("");
  const me = session?.user.id;
  const mine = me === authorId;

  async function flag() {
    const { error } = await supabase.from("content_flags").insert({
      post_id: replyId ? null : postId ?? null, reply_id: replyId ?? null, reporter_id: me!, reason, details: details.trim() || null,
    });
    if (error) { toast.error("Couldn't send your report. Please try again."); return; }
    setOpen(false); setDetails("");
    toast.success("Thanks — a moderator will review this.");
  }
  async function block() {
    if (!confirm("Block this member? You won't see each other's posts or replies.")) return;
    const { error } = await supabase.from("user_blocks").insert({ user_id: me!, blocked_id: authorId });
    if (error && !error.message.includes("duplicate")) { toast.error("Couldn't block this member."); return; }
    toast.success("Member blocked. You can unblock them from your profile.");
    qc.invalidateQueries();
  }
  async function remove() {
    if (!confirm("Delete this permanently?")) return;
    const q = replyId ? supabase.from("post_replies").delete().eq("id", replyId) : supabase.from("room_posts").delete().eq("id", postId!);
    const { error } = await q;
    if (error) { toast.error("Couldn't delete."); return; }
    toast.success("Deleted.");
    qc.invalidateQueries();
    onDeleted?.();
  }

  return (
    <div className="flex flex-wrap gap-1">
      {mine ? (
        <Button size="sm" variant="ghost" onClick={remove}><Trash2 className="mr-1 h-3.5 w-3.5" />Delete</Button>
      ) : (
        <>
          <Button size="sm" variant="ghost" onClick={() => setOpen(true)}><Flag className="mr-1 h-3.5 w-3.5" />Report</Button>
          <Button size="sm" variant="ghost" onClick={block}><Ban className="mr-1 h-3.5 w-3.5" />Block</Button>
        </>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report this {replyId ? "reply" : "post"}</DialogTitle>
            <DialogDescription>The author won't know who reported it.</DialogDescription>
          </DialogHeader>
          <RadioGroup value={reason} onValueChange={setReason} className="space-y-1">
            {FLAG_REASONS.map((r) => (
              <div key={r.value} className="flex items-center gap-2">
                <RadioGroupItem id={`fr-${r.value}`} value={r.value} />
                <Label htmlFor={`fr-${r.value}`}>{r.label}</Label>
              </div>
            ))}
          </RadioGroup>
          <Textarea placeholder="Anything else the moderator should know (optional)" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} />
          <DialogFooter><Button onClick={flag}>Send report</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
