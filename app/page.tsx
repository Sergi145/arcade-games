import { HomeClient } from "@/components/home-client";
import { getGames } from "@/lib/supabase/games";

export default async function Home() {
  const games = await getGames();

  return <HomeClient games={games} />;
}
