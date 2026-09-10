"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";

export type SessionUser = { name: string };

const USER_KEY = "av:user:v1";

type SessionContextValue = {
  user: SessionUser | null;
  login: (user: SessionUser) => void;
  logout: () => void;
  saveScore: (entry: {
    game: string;
    score: number;
    name: string;
  }) => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

const listeners = new Set<() => void>();
let cachedUser: SessionUser | null | undefined; // undefined = todavía no leído del cliente

function readUser(): SessionUser | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) ?? "null");
  } catch {
    return null;
  }
}

function getSnapshot(): SessionUser | null {
  if (cachedUser === undefined) cachedUser = readUser();
  return cachedUser;
}

function getServerSnapshot(): SessionUser | null {
  return null;
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === USER_KEY || e.key === null) {
      cachedUser = readUser();
      onStoreChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function setStoredUser(user: SessionUser | null) {
  cachedUser = user;
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    // localStorage no disponible (p. ej. modo privado): la sesión sigue viva en memoria para esta pestaña.
  }
  listeners.forEach((l) => l());
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const user = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const login = useCallback((u: SessionUser) => setStoredUser(u), []);
  const logout = useCallback(() => setStoredUser(null), []);
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
    <SessionContext.Provider value={{ user, login, logout, saveScore }}>
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
