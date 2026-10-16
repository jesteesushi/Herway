import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import {
  MessagesSquare,
  UserPlus,
  Send,
  ShieldAlert,
  VolumeX,
  Volume2,
  Ban,
  Globe,
  Sparkles,
  ArrowLeft,
  Check,
  X,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageContainer } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { looksIdentifying } from "@/lib/herway";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Messages — HerWay" },
      { name: "description", content: "Pseudonymous direct chats and friend requests for women in Bangladesh." },
      { property: "og:title", content: "Messages — HerWay" },
      { property: "og:description", content: "Pseudonymous direct chats and friend requests." },
    ],
  }),
  component: MessagesPage,
});

type Lang = "en" | "bn";

const T = {
  en: {
    title: "Messages",
    subtitle: "Pseudonymous, respectful 1:1 messaging. Never share phone numbers or home addresses.",
    chats: "Chats",
    requests: "Requests",
    newChat: "New Message",
    noChats: "No conversations yet.",
    startOne: "Send a friend request to start messaging.",
    selectChat: "Select a conversation to start reading.",
    typePlaceholder: "Type a message… (no personal details)",
    send: "Send",
    warningIdentifying: "Your message seems to contain contact information. Please remove it before sending.",
    mute: "Mute",
    unmute: "Unmute",
    block: "Block user",
    blockedSuccess: "User blocked. You will no longer receive messages from them.",
    requestsTitle: "Friend & Message Requests",
    noRequests: "No pending requests.",
    accept: "Accept",
    decline: "Decline",
    sendRequestPrompt: "Send a request by display name",
    recipientPlaceholder: "Member display name…",
    sendRequestBtn: "Send Request",
    requestSent: "Friend request sent!",
    safetyTipTitle: "Discreet & Pseudonymous",
    safetyTipBody: "Conversations are only linked to display names. HerWay does not display phone numbers, emails, or real names.",
  },
  bn: {
    title: "বার্তা আদান-প্রদান",
    subtitle: "ছদ্মনামে নিরাপদ ১:১ বার্তা। কখনো ফোন নম্বর বা বাসার ঠিকানা শেয়ার করবেন না।",
    chats: "কথোপকথন",
    requests: "অনুরোধসমূহ",
    newChat: "নতুন বার্তা",
    noChats: "এখনো কোনো বার্তা নেই।",
    startOne: "বার্তা পাঠাতে কোনো সদস্যকে বন্ধুত্বের অনুরোধ পাঠান।",
    selectChat: "বার্তা পড়তে একটি কথোপকথন নির্বাচন করুন।",
    typePlaceholder: "বার্তা লিখুন… (ব্যক্তিগত তথ্য পরিহার করুন)",
    send: "পাঠান",
    warningIdentifying: "আপনার বার্তায় ফোন নম্বর বা যোগাযোগের তথ্য থাকতে পারে। অনুগ্রহ করে এটি মুছে ফেলুন।",
    mute: "মিউট করুন",
    unmute: "আনমিউট করুন",
    block: "ব্লক করুন",
    blockedSuccess: "ব্যবহারকারীকে ব্লক করা হয়েছে।",
    requestsTitle: "বন্ধুত্ব ও বার্তার অনুরোধ",
    noRequests: "কোনো অপেক্ষমাণ অনুরোধ নেই।",
    accept: "গ্রহণ করুন",
    decline: "প্রত্যাখ্যান",
    sendRequestPrompt: "ডিসপ্লে নাম দিয়ে অনুরোধ পাঠান",
    recipientPlaceholder: "সদস্যের নাম…",
    sendRequestBtn: "অনুরোধ পাঠান",
    requestSent: "অনুরোধ পাঠানো হয়েছে!",
    safetyTipTitle: "গোপনীয় ও নিরাপদ",
    safetyTipBody: "বার্তা শুধুমাত্র আপনার ডিসপ্লে নামের সাথে যুক্ত থাকে। আপনার আসল নাম, ফোন বা ইমেইল কখনো প্রদর্শিত হয় না।",
  },
};

type Conversation = {
  id: string;
  title: string | null;
  updated_at: string;
  partnerName?: string;
  partnerId?: string;
  isMuted?: boolean;
};

type DirectMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

type FriendRequest = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  senderProfile?: { display_name: string };
  receiverProfile?: { display_name: string };
};

function MessagesPage() {
  const { session, ready } = useAuth();
  const [lang, setLang] = useState<Lang>("en");
  const t = T[lang];
  const qc = useQueryClient();

  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [targetDisplayName, setTargetDisplayName] = useState("");
  const [sendingRequest, setSendingRequest] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch user conversations
  const { data: conversations = [], isLoading: convsLoading } = useQuery({
    queryKey: ["conversations", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const myId = session!.user.id;
      // Get my participant records
      const { data: myParts } = await supabase
        .from("conversation_participants")
        .select("conversation_id, is_muted")
        .eq("user_id", myId);

      if (!myParts || myParts.length === 0) return [];

      const convIds = myParts.map((p) => p.conversation_id);

      // Get conversations and other participants
      const [{ data: convList }, { data: allParts }] = await Promise.all([
        supabase.from("conversations").select("*").in("id", convIds).order("updated_at", { ascending: false }),
        supabase.from("conversation_participants").select("conversation_id, user_id").in("conversation_id", convIds),
      ]);

      const otherUserIds = (allParts ?? []).filter((p) => p.user_id !== myId).map((p) => p.user_id);
      const { data: profiles } = otherUserIds.length
        ? await supabase.from("profiles").select("id, display_name").in("id", otherUserIds)
        : { data: [] };

      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
      const muteMap = new Map(myParts.map((p) => [p.conversation_id, p.is_muted]));

      return (convList ?? []).map((c) => {
        const otherP = (allParts ?? []).find((p) => p.conversation_id === c.id && p.user_id !== myId);
        return {
          ...c,
          partnerId: otherP?.user_id,
          partnerName: otherP ? profileMap.get(otherP.user_id) || "Anonymous Member" : "Direct Chat",
          isMuted: muteMap.get(c.id) || false,
        } as Conversation;
      });
    },
  });

  // Fetch active messages
  const { data: messages = [] } = useQuery({
    queryKey: ["direct_messages", activeConvId],
    enabled: !!activeConvId,
    refetchInterval: 4000,
    queryFn: async () => {
      const { data } = await supabase
        .from("direct_messages")
        .select("*")
        .eq("conversation_id", activeConvId!)
        .order("created_at", { ascending: true });
      return (data ?? []) as DirectMessage[];
    },
  });

  // Fetch pending friend requests
  const { data: friendRequests = [] } = useQuery({
    queryKey: ["friend_requests", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const myId = session!.user.id;
      const { data: reqs } = await supabase
        .from("friend_requests")
        .select("*")
        .eq("receiver_id", myId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (!reqs || reqs.length === 0) return [];
      const senderIds = reqs.map((r) => r.sender_id);
      const { data: senders } = await supabase.from("profiles").select("id, display_name").in("id", senderIds);
      const map = new Map((senders ?? []).map((s) => [s.id, s.display_name]));

      return reqs.map((r) => ({
        ...r,
        senderProfile: { display_name: map.get(r.sender_id) || "Member" },
      })) as FriendRequest[];
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!ready) return <PageContainer>Loading…</PageContainer>;
  if (!session) {
    return (
      <PageContainer className="max-w-md text-center py-12">
        <div className="mx-auto grid size-14 place-items-center rounded-3xl bg-secondary text-primary">
          <MessagesSquare className="size-6" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold">Sign in to use Messages</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          HerWay messages are pseudonymous and protected. Please sign in or create a pseudonymous account to chat.
        </p>
        <Link to="/login" search={{ redirect: "/messages" }} className="mt-6 inline-block rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground">
          Sign In
        </Link>
      </PageContainer>
    );
  }

  const activeConv = conversations.find((c) => c.id === activeConvId);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!activeConvId || !inputText.trim() || sending) return;
    if (looksIdentifying(inputText)) {
      toast.warning(t.warningIdentifying);
      return;
    }

    setSending(true);
    const body = inputText.trim();
    const { error } = await supabase.from("direct_messages").insert({
      conversation_id: activeConvId,
      sender_id: session!.user.id,
      body,
    });

    if (error) {
      toast.error("Could not send message. Please try again.");
    } else {
      setInputText("");
      await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", activeConvId);
      qc.invalidateQueries({ queryKey: ["direct_messages", activeConvId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    }
    setSending(false);
  }

  async function sendFriendRequest(e: React.FormEvent) {
    e.preventDefault();
    const query = targetDisplayName.trim();
    if (query.length < 2 || sendingRequest) return;
    setSendingRequest(true);

    try {
      const { data: found } = await supabase
        .from("profiles")
        .select("id, display_name")
        .ilike("display_name", query)
        .neq("id", session!.user.id)
        .limit(1)
        .maybeSingle();

      if (!found) {
        toast.error("Member not found with that display name.");
        setSendingRequest(false);
        return;
      }

      const { error } = await supabase.from("friend_requests").insert({
        sender_id: session!.user.id,
        receiver_id: found.id,
        status: "pending",
      });

      if (error) {
        if (error.code === "23505") {
          toast.info("A request is already pending with this member.");
        } else {
          toast.error("Could not send request: " + error.message);
        }
      } else {
        toast.success(t.requestSent);
        setTargetDisplayName("");
        qc.invalidateQueries({ queryKey: ["friend_requests"] });
      }
    } finally {
      setSendingRequest(false);
    }
  }

  async function handleRequest(req: FriendRequest, accept: boolean) {
    if (accept) {
      // 1. Update friend request status
      await supabase.from("friend_requests").update({ status: "accepted" }).eq("id", req.id);
      // 2. Create conversation
      const { data: conv } = await supabase.from("conversations").insert({ title: null }).select("id").single();
      if (conv) {
        // Add participants
        await supabase.from("conversation_participants").insert([
          { conversation_id: conv.id, user_id: session!.user.id },
          { conversation_id: conv.id, user_id: req.sender_id },
        ]);
        toast.success("Request accepted! Chat started.");
        setActiveConvId(conv.id);
      }
    } else {
      await supabase.from("friend_requests").update({ status: "declined" }).eq("id", req.id);
      toast.info("Request declined.");
    }
    qc.invalidateQueries({ queryKey: ["friend_requests"] });
    qc.invalidateQueries({ queryKey: ["conversations"] });
  }

  async function toggleMute(conv: Conversation) {
    const nextMuted = !conv.isMuted;
    await supabase
      .from("conversation_participants")
      .update({ is_muted: nextMuted })
      .eq("conversation_id", conv.id)
      .eq("user_id", session!.user.id);
    toast.success(nextMuted ? "Conversation muted" : "Conversation unmuted");
    qc.invalidateQueries({ queryKey: ["conversations"] });
  }

  async function blockPartner(partnerId: string) {
    if (!confirm("Block this user? They will not be able to send you messages or view your posts.")) return;
    await supabase.from("user_blocks").insert({ user_id: session!.user.id, blocked_id: partnerId });
    toast.success(t.blockedSuccess);
    setActiveConvId(null);
    qc.invalidateQueries({ queryKey: ["conversations"] });
  }

  return (
    <PageContainer className="max-w-5xl pb-16">
      {/* Header with Language Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLang(lang === "en" ? "bn" : "en")}
            className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            <Globe className="size-3.5 text-primary" />
            <span>{lang === "en" ? "বাংলা ইন্টারফেস" : "English"}</span>
          </button>
        </div>
      </div>

      {/* Safety Notice Banner */}
      <div className="mt-4 flex items-center gap-3 rounded-2xl border bg-secondary/60 p-4 text-xs leading-relaxed text-secondary-foreground">
        <ShieldAlert className="size-4 shrink-0 text-primary" />
        <div>
          <span className="font-semibold">{t.safetyTipTitle}:</span> {t.safetyTipBody}
        </div>
      </div>

      {/* Messaging Layout */}
      <Tabs defaultValue="chats" className="mt-6">
        <TabsList>
          <TabsTrigger value="chats" className="gap-1.5">
            <MessagesSquare className="size-4" /> {t.chats} ({conversations.length})
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-1.5">
            <UserPlus className="size-4" /> {t.requests}
            {friendRequests.length > 0 && (
              <span className="ml-1 grid size-5 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold">
                {friendRequests.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Chats Tab */}
        <TabsContent value="chats" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] rounded-3xl border bg-card shadow-soft overflow-hidden min-h-[500px]">
            {/* Conversations List */}
            <div className={cn("border-r divide-y overflow-y-auto max-h-[600px]", activeConvId && "hidden md:block")}>
              {conversations.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <p>{t.noChats}</p>
                  <p className="mt-1 text-xs">{t.startOne}</p>
                </div>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveConvId(c.id)}
                    className={cn(
                      "w-full p-4 text-left transition hover:bg-muted flex items-center justify-between",
                      activeConvId === c.id && "bg-secondary/70 font-semibold"
                    )}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="truncate text-sm font-semibold">{c.partnerName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {new Date(c.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    {c.isMuted && <VolumeX className="size-3.5 text-muted-foreground shrink-0" />}
                  </button>
                ))
              )}
            </div>

            {/* Chat Pane */}
            <div className={cn("flex flex-col h-[550px]", !activeConvId && "hidden md:flex items-center justify-center")}>
              {activeConv ? (
                <>
                  {/* Chat Pane Header */}
                  <div className="flex items-center justify-between border-b px-4 py-3 bg-card">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setActiveConvId(null)} className="md:hidden grid size-8 place-items-center rounded-full hover:bg-muted">
                        <ArrowLeft className="size-4" />
                      </button>
                      <div>
                        <h2 className="font-semibold text-sm">{activeConv.partnerName}</h2>
                        <span className="text-[11px] text-muted-foreground">Pseudonymous 1:1 chat</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => toggleMute(activeConv)} title={activeConv.isMuted ? t.unmute : t.mute}>
                        {activeConv.isMuted ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
                      </Button>
                      {activeConv.partnerId && (
                        <Button size="sm" variant="ghost" onClick={() => blockPartner(activeConv.partnerId!)} title={t.block}>
                          <Ban className="size-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Messages Bubble History */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
                    {messages.length === 0 ? (
                      <p className="text-center text-xs text-muted-foreground py-8">Start the conversation respectfully.</p>
                    ) : (
                      messages.map((m) => {
                        const isMe = m.sender_id === session.user.id;
                        return (
                          <div key={m.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                            <div
                              className={cn(
                                "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                                isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border text-foreground rounded-bl-sm shadow-soft"
                              )}
                            >
                              <p className="whitespace-pre-wrap">{m.body}</p>
                            </div>
                            <span className="text-[10px] text-muted-foreground mt-0.5 px-1">
                              {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Composer */}
                  <form onSubmit={sendMessage} className="p-3 border-t bg-card flex gap-2">
                    <Input
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder={t.typePlaceholder}
                      maxLength={2000}
                      className="flex-1 rounded-xl"
                    />
                    <Button type="submit" disabled={sending || !inputText.trim()} className="rounded-xl px-4">
                      <Send className="size-4" />
                    </Button>
                  </form>
                </>
              ) : (
                <div className="text-center p-8 text-muted-foreground space-y-2">
                  <MessagesSquare className="size-8 mx-auto opacity-40" />
                  <p className="text-sm">{t.selectChat}</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Friend Requests Tab */}
        <TabsContent value="requests" className="mt-4 space-y-6">
          {/* Send Request Form */}
          <section className="rounded-3xl border bg-card p-6 shadow-soft space-y-3">
            <h2 className="text-base font-semibold">{t.sendRequestPrompt}</h2>
            <form onSubmit={sendFriendRequest} className="flex gap-2 max-w-md">
              <Input
                value={targetDisplayName}
                onChange={(e) => setTargetDisplayName(e.target.value)}
                placeholder={t.recipientPlaceholder}
                maxLength={40}
                className="rounded-xl"
              />
              <Button type="submit" disabled={sendingRequest || !targetDisplayName.trim()} className="rounded-xl">
                {sendingRequest ? "Sending…" : t.sendRequestBtn}
              </Button>
            </form>
          </section>

          {/* Pending Requests List */}
          <section className="rounded-3xl border bg-card p-6 shadow-soft space-y-3">
            <h2 className="text-base font-semibold">{t.requestsTitle}</h2>
            {friendRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.noRequests}</p>
            ) : (
              <ul className="divide-y">
                {friendRequests.map((r) => (
                  <li key={r.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary font-bold text-xs">
                        {r.senderProfile?.display_name?.slice(0, 2).toUpperCase() || "ME"}
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{r.senderProfile?.display_name}</p>
                        <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleRequest(r, true)} className="gap-1 rounded-xl">
                        <Check className="size-3.5" /> {t.accept}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleRequest(r, false)} className="gap-1 rounded-xl">
                        <X className="size-3.5" /> {t.decline}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
