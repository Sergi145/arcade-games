"use client";

import { useCallback, useSyncExternalStore } from "react";

export type SkinId = "clasico" | "neon" | "retro";

export const SKIN_LABELS: Record<SkinId, string> = {
  clasico: "CLÁSICO",
  neon: "NEÓN",
  retro: "RETRO",
};

const VALID_SKINS: SkinId[] = ["clasico", "neon", "retro"];

function skinStorageKey(gameId: string) {
  return `av:skin:${gameId}`;
}

// Mismo patrón que lib/session.tsx (av:user:v1): useSyncExternalStore lee
// localStorage de forma segura para SSR (getServerSnapshot devuelve el
// valor por defecto) y evita el antipatrón de llamar a setState dentro de
// un efecto solo para hidratar un valor persistido.
const listeners = new Set<() => void>();
const cache = new Map<string, SkinId>();

function readStoredSkin(gameId: string): SkinId {
  try {
    const stored = localStorage.getItem(skinStorageKey(gameId));
    if (stored && (VALID_SKINS as string[]).includes(stored)) {
      return stored as SkinId;
    }
  } catch {
    // localStorage no disponible (p. ej. modo privado): se queda en "clasico".
  }
  return "clasico";
}

function getSnapshot(gameId: string): SkinId {
  if (!cache.has(gameId)) cache.set(gameId, readStoredSkin(gameId));
  return cache.get(gameId)!;
}

function getServerSnapshot(): SkinId {
  return "clasico";
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function writeSkin(gameId: string, next: SkinId) {
  cache.set(gameId, next);
  try {
    localStorage.setItem(skinStorageKey(gameId), next);
  } catch {
    // localStorage no disponible: la selección solo dura esta sesión.
  }
  listeners.forEach((l) => l());
}

/** Persiste y lee la skin elegida para un juego concreto (clave `av:skin:<gameId>`). */
export function useSkinPreference(
  gameId: string,
): [SkinId, (next: SkinId) => void] {
  const skin = useSyncExternalStore(
    subscribe,
    () => getSnapshot(gameId),
    getServerSnapshot,
  );
  const setSkin = useCallback((next: SkinId) => writeSkin(gameId, next), [gameId]);
  return [skin, setSkin];
}
