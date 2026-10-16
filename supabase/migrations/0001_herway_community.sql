CREATE TABLE public.community_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.community_rooms TO authenticated;
GRANT ALL ON public.community_rooms TO service_role;
ALTER TABLE public.community_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read active rooms" ON public.community_rooms FOR SELECT TO authenticated USING (is_active OR public.is_moderator(auth.uid()));

CREATE TABLE public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, blocked_id),
  CHECK (user_id <> blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
GRANT ALL ON public.user_blocks TO service_role;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage blocks" ON public.user_blocks FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_blocked(_a uuid, _b uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_blocks WHERE (user_id = _a AND blocked_id = _b) OR (user_id = _b AND blocked_id = _a))
$$;

CREATE TABLE public.room_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.community_rooms(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 140),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  removed_at timestamptz,
  removed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX room_posts_room_idx ON public.room_posts(room_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_posts TO authenticated;
GRANT ALL ON public.room_posts TO service_role;
ALTER TABLE public.room_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read visible posts" ON public.room_posts FOR SELECT TO authenticated
  USING (public.is_moderator(auth.uid()) OR author_id = auth.uid() OR (removed_at IS NULL AND NOT public.is_blocked(auth.uid(), author_id)));
CREATE POLICY "Write own posts" ON public.room_posts FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND removed_at IS NULL AND removed_by IS NULL);
CREATE POLICY "Moderators update posts" ON public.room_posts FOR UPDATE TO authenticated USING (public.is_moderator(auth.uid()));
CREATE POLICY "Delete own posts" ON public.room_posts FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.is_moderator(auth.uid()));

CREATE TABLE public.post_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.room_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  removed_at timestamptz,
  removed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX post_replies_post_idx ON public.post_replies(post_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_replies TO authenticated;
GRANT ALL ON public.post_replies TO service_role;
ALTER TABLE public.post_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read visible replies" ON public.post_replies FOR SELECT TO authenticated
  USING (public.is_moderator(auth.uid()) OR author_id = auth.uid() OR (removed_at IS NULL AND NOT public.is_blocked(auth.uid(), author_id)));
CREATE POLICY "Write own replies" ON public.post_replies FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND removed_at IS NULL AND removed_by IS NULL
    AND EXISTS (SELECT 1 FROM public.room_posts p WHERE p.id = post_id AND p.removed_at IS NULL AND NOT public.is_blocked(auth.uid(), p.author_id)));
CREATE POLICY "Moderators update replies" ON public.post_replies FOR UPDATE TO authenticated USING (public.is_moderator(auth.uid()));
CREATE POLICY "Delete own replies" ON public.post_replies FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.is_moderator(auth.uid()));

CREATE TABLE public.content_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.room_posts(id) ON DELETE CASCADE,
  reply_id uuid REFERENCES public.post_replies(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (post_id IS NOT NULL OR reply_id IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE ON public.content_flags TO authenticated;
GRANT ALL ON public.content_flags TO service_role;
ALTER TABLE public.content_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reporters submit flags" ON public.content_flags FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid() AND status = 'open');
CREATE POLICY "Reporters and moderators read flags" ON public.content_flags FOR SELECT TO authenticated USING (reporter_id = auth.uid() OR public.is_moderator(auth.uid()));
CREATE POLICY "Moderators resolve content flags" ON public.content_flags FOR UPDATE TO authenticated USING (public.is_moderator(auth.uid()));

CREATE OR REPLACE FUNCTION public.limit_community_rate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'room_posts' THEN
    IF (SELECT count(*) FROM public.room_posts WHERE author_id = NEW.author_id AND created_at > now() - interval '24 hours') >= 10 THEN
      RAISE EXCEPTION 'You can start up to 10 posts per day.';
    END IF;
  ELSE
    IF (SELECT count(*) FROM public.post_replies WHERE author_id = NEW.author_id AND created_at > now() - interval '24 hours') >= 30 THEN
      RAISE EXCEPTION 'You can write up to 30 replies per day.';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER room_posts_rate BEFORE INSERT ON public.room_posts FOR EACH ROW EXECUTE FUNCTION public.limit_community_rate();
CREATE TRIGGER post_replies_rate BEFORE INSERT ON public.post_replies FOR EACH ROW EXECUTE FUNCTION public.limit_community_rate();

INSERT INTO public.community_rooms (slug, name, description, sort_order) VALUES
 ('commuting', 'Commuting & transport', 'Buses, CNGs, rickshaws, ride-hailing and getting around safely.', 1),
 ('campus-life', 'Campus life', 'Universities, colleges, hostels and student experiences.', 2),
 ('workplace', 'Workplace', 'Dealing with harassment at work, rights and reporting options.', 3),
 ('practical-advice', 'Practical advice', 'Tips, tools and support that have helped you.', 4);