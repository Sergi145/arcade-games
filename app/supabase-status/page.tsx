import { createClient } from "@/lib/supabase/server";

export default async function SupabaseStatusPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("health_check")
    .select("message, created_at")
    .limit(1)
    .single();

  return (
    <div
      style={{
        maxWidth: 480,
        margin: "48px auto",
        padding: "24px 28px",
        border: "1px solid var(--line)",
        fontFamily: "var(--mono)",
        fontSize: 13,
        lineHeight: 1.6,
      }}
    >
      <h1
        style={{ fontFamily: "var(--pixel)", fontSize: 14, marginBottom: 16 }}
      >
        SUPABASE STATUS
      </h1>
      {error ? (
        <p style={{ color: "#ff5c5c" }}>
          ❌ Error al conectar con Supabase: {error.message}
        </p>
      ) : (
        <>
          <p style={{ color: "#5cff8a" }}>✅ {data.message}</p>
          <p style={{ color: "var(--ink-faint)" }}>
            {new Date(data.created_at).toLocaleString("es-ES")}
          </p>
        </>
      )}
    </div>
  );
}
