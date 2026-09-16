"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export type SessionUser = { name: string };

type SessionContextValue = {
  user: SessionUser | null;
  logout: () => void;
  saveScore: (entry: {
    game: string;
    score: number;
    name: string;
  }) => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

function pickString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function deriveName(session: Session): string {
  const metadata = session.user.user_metadata;
  const raw =
    pickString(metadata.name) ??
    pickString(metadata.full_name) ??
    pickString(metadata.user_name) ??
    session.user.email?.split("@")[0] ??
    "JUGADOR";
  return raw.toUpperCase().slice(0, 10);
}

function toSessionUser(session: Session | null): SessionUser | null {
  return session ? { name: deriveName(session) } : null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data }) => {
      setUser(toSessionUser(data.session));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(toSessionUser(session));
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = useCallback(() => {
    void createClient().auth.signOut();
  }, []);

  const saveScore = useCallback(
    async (entry: { game: string; score: number; name: string }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("scores")
        .insert({ game_id: entry.game, name: entry.name, score: entry.score });
      if (error) throw error;
    },
    [],
  );

  return (
    <SessionContext.Provider value={{ user, logout, saveScore }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx)
    throw new Error("useSession debe usarse dentro de un SessionProvider");
  return ctx;
}
