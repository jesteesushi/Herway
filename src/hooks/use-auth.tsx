import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthState = {
  session: Session | null;
  ready: boolean;
  isModerator: boolean;
  displayName: string | null;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  session: null,
  ready: false,
  isModerator: false,
  displayName: null,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);

  async function loadExtras(s: Session | null) {
    if (!s) {
      setIsModerator(false);
      setDisplayName(null);
      return;
    }
    const uid = s.user.id;
    const [{ data: roles }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("profiles").select("display_name").eq("id", uid).maybeSingle(),
    ]);
    setIsModerator(!!roles?.some((r) => r.role === "moderator" || r.role === "admin"));
    if (profile) {
      setDisplayName(profile.display_name);
    } else {
      const meta = (s.user.user_metadata?.["display_name"] as string | undefined)?.trim();
      const name = meta && meta.length >= 2 ? meta.slice(0, 40) : `Member ${uid.slice(0, 4)}`;
      await supabase.from("profiles").insert({ id: uid, display_name: name });
      setDisplayName(name);
    }
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setTimeout(() => void loadExtras(s), 0);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      void loadExtras(data.session).finally(() => setReady(true));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, ready, isModerator, displayName, refreshProfile: () => loadExtras(session) }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
