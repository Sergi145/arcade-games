"use client";

import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from "react";

export type SessionUser = { name: string };
export type SavedScore = { game: string; score: number; name: string; at: number };

const USER_KEY = "av:user:v1";
const SCORES_KEY = "av:scores:v1";

type SessionContextValue = {
  user: SessionUser | null;
  login: (user: SessionUser) => void;
  logout: () => void;
  saveScore: (entry: { game: string; score: number; name: string }) => void;
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

function appendSavedScore(entry: SavedScore) {
  try {
    const all: SavedScore[] = JSON.parse(localStorage.getItem(SCORES_KEY) ?? "[]");
    all.push(entry);
    localStorage.setItem(SCORES_KEY, JSON.stringify(all));
  } catch {
    // localStorage no disponible: la puntuación no persiste, pero el modal igualmente confirma el guardado.
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const user = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const login = useCallback((u: SessionUser) => setStoredUser(u), []);
  const logout = useCallback(() => setStoredUser(null), []);
  const saveScore = useCallback((entry: { game: string; score: number; name: string }) => {
    appendSavedScore({ ...entry, at: Date.now() });
  }, []);

  return (
    <SessionContext.Provider value={{ user, login, logout, saveScore }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession debe usarse dentro de un SessionProvider");
  return ctx;
}
