import { SalonDeLaFamaClient } from "@/components/salon-de-la-fama-client";
import { getGames } from "@/lib/supabase/games";

export default async function HallOfFamePage() {
  const games = await getGames();

  return <SalonDeLaFamaClient games={games} />;
}
