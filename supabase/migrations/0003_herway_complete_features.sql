-- Migration 0003: Complete site features
-- Includes: User mutes, Incident appeals, Profile privacy settings,
-- Direct messaging & friend requests, and verified support directory.

-- 1. USER MUTES
CREATE TABLE IF NOT EXISTS public.user_mutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  muted_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, muted_id),
  CHECK (user_id <> muted_id)
);
GRANT SELECT, INSERT, DELETE ON public.user_mutes TO authenticated;
GRANT ALL ON public.user_mutes TO service_role;
ALTER TABLE public.user_mutes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage mutes" ON public.user_mutes
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_muted(_a uuid, _b uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_mutes WHERE user_id = _a AND muted_id = _b)
$$;

-- 2. PROFILE PRIVACY & NOTIFICATION SETTINGS
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS allow_direct_messages boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_on_replies boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_on_status_change boolean NOT NULL DEFAULT true;

-- 3. INCIDENT APPEALS
CREATE TABLE IF NOT EXISTS public.incident_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.incident_reports(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 1000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  moderator_id uuid,
  moderator_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.incident_appeals TO authenticated;
GRANT ALL ON public.incident_appeals TO service_role;
ALTER TABLE public.incident_appeals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reporters read own appeals" ON public.incident_appeals
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.is_moderator(auth.uid()));

CREATE POLICY "Reporters submit own appeals" ON public.incident_appeals
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid() AND status = 'pending');

CREATE POLICY "Moderators update appeals" ON public.incident_appeals
  FOR UPDATE TO authenticated
  USING (public.is_moderator(auth.uid()));

-- 4. MESSAGING & FRIEND REQUESTS
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sender_id, receiver_id),
  CHECK (sender_id <> receiver_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_requests TO authenticated;
GRANT ALL ON public.friend_requests TO service_role;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own friend requests" ON public.friend_requests
  FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users send friend requests" ON public.friend_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND NOT public.is_blocked(auth.uid(), receiver_id)
  );

CREATE POLICY "Users update received requests" ON public.friend_requests
  FOR UPDATE TO authenticated
  USING (receiver_id = auth.uid() OR sender_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  is_muted boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_participants TO authenticated;
GRANT ALL ON public.conversation_participants TO service_role;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read conversation participants" ON public.conversation_participants
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users join or add to conversations" ON public.conversation_participants
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users update own participant record" ON public.conversation_participants
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Members read conversations" ON public.conversations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = id AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users create conversations" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS direct_messages_conv_idx ON public.direct_messages(conversation_id, created_at);
GRANT SELECT, INSERT ON public.direct_messages TO authenticated;
GRANT ALL ON public.direct_messages TO service_role;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read messages" ON public.direct_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Members send messages" ON public.direct_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()
    )
  );

-- 5. POPULATE VERIFIED SUPPORT SERVICES & HELPLINES
UPDATE public.support_resources
SET is_verified = true, hours = '24 hours / 7 days', last_checked = CURRENT_DATE
WHERE phone IN ('999', '109');

INSERT INTO public.support_resources (name, phone, url, description, kind, hours, is_verified, last_checked, sort_order) VALUES
('National Legal Aid Helpline', '16430', 'http://www.nlaso.gov.bd', 'Government legal aid service providing free legal counseling and representation for women and underprivileged citizens.', 'service', '9:00 AM – 5:00 PM (Govt working days)', true, CURRENT_DATE, 3),
('Ain o Salish Kendra (ASK) Legal Helpline', '01724415677', 'https://www.askbd.org', 'Human rights and legal aid organization providing immediate counseling and emergency legal assistance for gender-based violence.', 'service', '9:00 AM – 8:00 PM (Every day)', true, CURRENT_DATE, 4),
('Bangladesh National Women Lawyers Association (BNWLA)', '01715247844', 'http://bnwla-bd.org', 'Legal counsel, court representation, and temporary shelter referral for women and girls facing harassment, violence, or stalking.', 'service', '24 hours emergency support', true, CURRENT_DATE, 5),
('Kaan Pete Roi (Emotional Support & Crisis Helpline)', '01779554391', 'https://shuni.org', 'Confidential emotional helpline in Bangladesh offering compassionate listening for distress, trauma, and crisis.', 'helpline', '3:00 PM – 3:00 AM (Daily)', true, CURRENT_DATE, 6),
('Dhaka Medical College One-Stop Crisis Centre (OCC)', '02-55165088', 'http://www.dmc.gov.bd', 'Comprehensive medical care, forensic assistance, psychological counseling, and legal assistance in one secure ward.', 'emergency', '24 hours emergency admission', true, CURRENT_DATE, 7),
('BRAC Human Rights and Legal Aid Services (HRLS)', '01713044444', 'https://www.brac.net', 'Community-level legal clinics and trauma support throughout 64 districts in Bangladesh.', 'service', '9:00 AM – 5:00 PM', true, CURRENT_DATE, 8)
ON CONFLICT DO NOTHING;
