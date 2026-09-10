import { BibliotecaClient } from "@/components/biblioteca-client";
import { getGames } from "@/lib/supabase/games";

export default async function Home() {
  const games = await getGames();

  return <BibliotecaClient games={games} />;
}
