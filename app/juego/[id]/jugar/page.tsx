import { notFound } from "next/navigation";
import { JugarClient } from "@/components/jugar-client";
import { getGame } from "@/lib/supabase/games";

export default async function GamePlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();

  return <JugarClient game={game} />;
}
