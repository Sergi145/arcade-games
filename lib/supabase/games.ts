import { createClient } from "@/lib/supabase/server";
import type { Game } from "@/lib/games";

export async function getGames(): Promise<Game[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("games").select("*");
  if (error) throw error;
  return data as Game[];
}

export async function getGame(id: string): Promise<Game | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("games").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Game | null;
}
