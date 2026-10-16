import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageContainer } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { looksIdentifying } from "@/lib/herway";
import { ContentActions, timeAgo, useDisplayNames } from "@/components/community/ContentActions";

export const Route = createFileRoute("/_authenticated/community/$slug/$postId")({
  head: () => ({ meta: [{ title: "Community post — HerWay" }, { name: "description", content: "A post and replies in a HerWay community room." }, { property: "og:title", content: "Community post — HerWay" }, { property: "og:description", content: "A post and replies in a HerWay community room." }] }),
  component: Post,
});

function Post() {
  const { slug, postId } = Route.useParams();
  const { session } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: post, isLoading } = useQuery({
    queryKey: ["post", postId],
    queryFn: async () => (await supabase.from("room_posts").select("*").eq("id", postId).maybeSingle()).data,
  });
  const { data: replies = [] } = useQuery({
    queryKey: ["replies", postId],
    queryFn: async () => (await supabase.from("post_replies").select("*").eq("post_id", postId).is("removed_at", null).order("created_at")).data ?? [],
  });
  const name = useDisplayNames([...(post ? [post.author_id] : []), ...replies.map((r) => r.author_id)]);
  const back = () => navigate({ to: "/community/$slug", params: { slug } });

  async function send() {
    if (!reply.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("post_replies").insert({ post_id: postId, author_id: session!.user.id, body: reply.trim() });
    setBusy(false);
    if (error) { toast.error(error.message.includes("per day") ? error.message : "Couldn't reply. Please try again."); return; }
    setReply("");
    qc.invalidateQueries({ queryKey: ["replies", postId] });
  }

  if (isLoading) return <PageContainer>Loading…</PageContainer>;
  if (!post || post.removed_at)
    return <PageContainer><p>This post isn't available. It may have been removed, or you may have blocked its author.</p><Link to="/community/$slug" params={{ slug }} className="text-primary underline">Back to room</Link></PageContainer>;

  return (
    <PageContainer>
      <Link to="/community/$slug" params={{ slug }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to room</Link>
      <article className="mt-3 rounded-2xl border bg-card p-5">
        <h1 className="text-2xl font-semibold">{post.title}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{name(post.author_id)} · {timeAgo(post.created_at)}</p>
        <p className="mt-4 whitespace-pre-wrap">{post.body}</p>
        <div className="mt-3 border-t pt-2"><ContentActions authorId={post.author_id} postId={post.id} onDeleted={back} /></div>
      </article>

      <h2 className="mt-6 text-lg font-semibold">{replies.length} {replies.length === 1 ? "reply" : "replies"}</h2>
      <ul className="mt-2 space-y-2">
        {replies.map((r) => (
          <li key={r.id} className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{name(r.author_id)} · {timeAgo(r.created_at)}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm">{r.body}</p>
            <div className="mt-2"><ContentActions authorId={r.author_id} postId={post.id} replyId={r.id} /></div>
          </li>
        ))}
      </ul>

      <div className="mt-4 space-y-2 rounded-2xl border bg-card p-4">
        <Textarea placeholder="Write a supportive reply" value={reply} onChange={(e) => setReply(e.target.value)} maxLength={2000} />
        {looksIdentifying(reply) && <p className="rounded-xl bg-secondary p-3 text-sm">This may include personal contact details. Please remove them.</p>}
        <Button onClick={send} disabled={busy || !reply.trim()}>{busy ? "Sending…" : "Reply"}</Button>
      </div>
    </PageContainer>
  );
}
