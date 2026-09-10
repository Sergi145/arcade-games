import { createClient } from "@/lib/supabase/server";
import type { ScoreRow } from "@/lib/scores";

export async function getTopScores(gameId: string, limit: number): Promise<ScoreRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scores")
    .select("name, score, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row, i) => ({
    rank: i + 1,
    name: row.name,
    score: row.score,
    date: new Date(row.created_at).toLocaleDateString("es-ES"),
  }));
}
