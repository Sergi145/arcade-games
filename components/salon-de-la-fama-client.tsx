"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Game } from "@/lib/games";
import type { ScoreRow } from "@/lib/scores";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";

function mapRows(
  data: { name: string; score: number; created_at: string }[],
): ScoreRow[] {
  return data.map((row, i) => ({
    rank: i + 1,
    name: row.name,
    score: row.score,
    date: new Date(row.created_at).toLocaleDateString("es-ES"),
  }));
}

export function SalonDeLaFamaClient({ games }: { games: Game[] }) {
  const { user } = useSession();
  const [tab, setTab] = useState(games[0].id);
  const [scoresState, setScoresState] = useState<{
    tab: string;
    rows: ScoreRow[];
  } | null>(null);
  const youKey = `${tab}::${user?.name ?? ""}`;
  const [youState, setYouState] = useState<{
    key: string;
    you: ScoreRow | null;
  } | null>(null);
  const game = games.find((g) => g.id === tab)!;

  const loadingRows = scoresState?.tab !== tab;
  const rows = scoresState?.tab === tab ? scoresState.rows : [];
  const you = !user || youState?.key !== youKey ? null : youState.you;

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("scores")
      .select("name, score, created_at")
      .eq("game_id", tab)
      .order("score", { ascending: false })
      .limit(12)
      .then(({ data, error }) => {
        if (cancelled) return;
        setScoresState({ tab, rows: error || !data ? [] : mapRows(data) });
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const { data, error } = await supabase
        .from("scores")
        .select("name, score, created_at")
        .eq("game_id", tab)
        .ilike("name", user.name)
        .order("score", { ascending: false })
        .limit(1);
      if (cancelled) return;
      if (error || !data || data.length === 0) {
        setYouState({ key: youKey, you: null });
        return;
      }
      const best = data[0];
      const { count } = await supabase
        .from("scores")
        .select("*", { count: "exact", head: true })
        .eq("game_id", tab)
        .gt("score", best.score);
      if (cancelled) return;
      setYouState({
        key: youKey,
        you: {
          rank: (count ?? 0) + 1,
          name: best.name,
          score: best.score,
          date: new Date(best.created_at).toLocaleDateString("es-ES"),
        },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, user, youKey]);

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {games.map((g) => (
          <button
            key={g.id}
            className={"chip" + (tab === g.id ? " active" : "")}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      {loadingRows ? (
        <p style={{ textAlign: "center", color: "var(--ink-faint)" }}>
          CARGANDO...
        </p>
      ) : rows.length === 0 ? (
        <p style={{ textAlign: "center", color: "var(--ink-faint)" }}>
          AÚN NO HAY PUNTUACIONES
        </p>
      ) : (
        <>
          <div className="podium">
            {rows[1] && (
              <div className="podium-slot silver">
                <div className="rank-num">02</div>
                <div className="name">{rows[1].name}</div>
                <div className="score">
                  {rows[1].score.toLocaleString("es-ES")}
                </div>
                <div className="date">{rows[1].date}</div>
              </div>
            )}
            {rows[0] && (
              <div className="podium-slot gold">
                <div
                  className="pixel"
                  style={{
                    fontSize: 9,
                    color: "var(--gold)",
                    letterSpacing: "0.18em",
                  }}
                >
                  CAMPEÓN
                </div>
                <div
                  className="rank-num"
                  style={{ fontSize: 36, marginTop: 4 }}
                >
                  01
                </div>
                <div className="name">{rows[0].name}</div>
                <div className="score" style={{ fontSize: 20 }}>
                  {rows[0].score.toLocaleString("es-ES")}
                </div>
                <div className="date">{rows[0].date}</div>
              </div>
            )}
            {rows[2] && (
              <div className="podium-slot bronze">
                <div className="rank-num">03</div>
                <div className="name">{rows[2].name}</div>
                <div className="score">
                  {rows[2].score.toLocaleString("es-ES")}
                </div>
                <div className="date">{rows[2].date}</div>
              </div>
            )}
          </div>

          <div className="hall-table">
            <div className="th">
              <div>RANGO</div>
              <div>JUGADOR</div>
              <div>PUNTUACIÓN</div>
              <div>FECHA</div>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.rank}
                className={
                  "tr" +
                  (i === 0
                    ? " top1"
                    : i === 1
                      ? " top2"
                      : i === 2
                        ? " top3"
                        : "")
                }
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
                <div className="pl">{r.name}</div>
                <div className="sc">{r.score.toLocaleString("es-ES")}</div>
                <div className="dt">{r.date}</div>
              </div>
            ))}
            {you && (
              <>
                <div className="tr you-label">
                  ▸ TU MEJOR MARCA EN {game.title}
                </div>
                <div
                  className="tr you"
                  style={{ animationDelay: `${rows.length * 50 + 50}ms` }}
                >
                  <div className="rk" style={{ color: "var(--yellow)" }}>
                    #{String(you.rank).padStart(2, "0")}
                  </div>
                  <div className="pl" style={{ color: "var(--yellow)" }}>
                    {you.name}
                  </div>
                  <div
                    className="sc"
                    style={{
                      color: "var(--yellow)",
                      textShadow: "0 0 6px rgba(245,255,0,0.5)",
                    }}
                  >
                    {you.score.toLocaleString("es-ES")}
                  </div>
                  <div className="dt">{you.date}</div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link className="btn lg" href="/biblioteca">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
