import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageContainer } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { looksIdentifying } from "@/lib/herway";
import { timeAgo, useDisplayNames } from "@/components/community/ContentActions";

export const Route = createFileRoute("/_authenticated/community/$slug/")({
  head: () => ({ meta: [{ title: "Community room — HerWay" }, { name: "description", content: "Posts and advice in a HerWay community room." }, { property: "og:title", content: "Community room — HerWay" }, { property: "og:description", content: "Posts and advice in a HerWay community room." }] }),
  component: Room,
});

function Room() {
  const { slug } = Route.useParams();
  const { session } = useAuth();
  const qc = useQueryClient();
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: room, isLoading } = useQuery({
    queryKey: ["room", slug],
    queryFn: async () => (await supabase.from("community_rooms").select("*").eq("slug", slug).maybeSingle()).data,
  });
  const { data: posts = [] } = useQuery({
    queryKey: ["room-posts", room?.id],
    enabled: !!room,
    queryFn: async () => (await supabase.from("room_posts").select("id, title, body, author_id, created_at, removed_at, post_replies(count)").eq("room_id", room!.id).is("removed_at", null).order("created_at", { ascending: false })).data ?? [],
  });
  const name = useDisplayNames(posts.map((p) => p.author_id));

  async function submit() {
    if (title.trim().length < 3 || !body.trim()) { toast.error("Add a title and a message."); return; }
    setBusy(true);
    const { error } = await supabase.from("room_posts").insert({ room_id: room!.id, author_id: session!.user.id, title: title.trim(), body: body.trim() });
    setBusy(false);
    if (error) { toast.error(error.message.includes("per day") ? error.message : "Couldn't post. Please try again."); return; }
    setTitle(""); setBody(""); setComposing(false);
    qc.invalidateQueries({ queryKey: ["room-posts"] });
    qc.invalidateQueries({ queryKey: ["room-counts"] });
  }

  if (isLoading) return <PageContainer>Loading…</PageContainer>;
  if (!room) return <PageContainer><p>Room not found.</p><Link to="/community" className="text-primary underline">All rooms</Link></PageContainer>;
  const warn = looksIdentifying(`${title} ${body}`);

  return (
    <PageContainer>
      <Link to="/community" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />All rooms</Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">{room.name}</h1>
          <p className="mt-1 text-muted-foreground">{room.description}</p>
        </div>
        {!composing && <Button onClick={() => setComposing(true)}>New post</Button>}
      </div>

      {composing && (
        <div className="mt-4 space-y-3 rounded-2xl border bg-card p-4">
          <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} />
          <Textarea placeholder="What would you like to share or ask?" rows={5} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} />
          {warn && <p className="rounded-xl bg-secondary p-3 text-sm">This looks like it may include a phone number, email or social handle. Please remove personal details before posting.</p>}
          <div className="flex gap-2">
            <Button onClick={submit} disabled={busy}>{busy ? "Posting…" : "Post"}</Button>
            <Button variant="ghost" onClick={() => setComposing(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-2">
        {posts.map((p) => (
          <Link key={p.id} to="/community/$slug/$postId" params={{ slug, postId: p.id }} className="block rounded-2xl border bg-card p-4 hover:bg-muted">
            <h2 className="font-semibold">{p.title}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.body}</p>
            <p className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span>{name(p.author_id)} · {timeAgo(p.created_at)}</span>
              <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{(p.post_replies as unknown as { count: number }[])[0]?.count ?? 0}</span>
            </p>
          </Link>
        ))}
        {posts.length === 0 && <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">No posts yet. Start the conversation.</p>}
      </div>
    </PageContainer>
  );
}
