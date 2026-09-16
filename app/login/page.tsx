"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "EMAIL O CONTRASEÑA INCORRECTOS.";
  if (m.includes("already registered") || m.includes("already exists"))
    return "ESE EMAIL YA TIENE UNA CUENTA.";
  if (m.includes("password should be at least"))
    return "LA CONTRASEÑA DEBE TENER AL MENOS 6 CARACTERES.";
  if (
    m.includes("unsupported provider") ||
    m.includes("provider is not enabled")
  )
    return "ESTE MÉTODO DE ACCESO NO ESTÁ DISPONIBLE AHORA MISMO.";
  return "ALGO FALLÓ. INTÉNTALO DE NUEVO.";
}

export default function LoginPage() {
  const router = useRouter();
  const { user, logout } = useSession();
  const [tab, setTab] = useState<"in" | "up">("in");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(
    null,
  );

  const switchTab = (t: "in" | "up") => {
    setTab(t);
    setError(null);
  };

  const submitSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    setLoading(false);
    if (error) {
      setError(translateAuthError(error.message));
      return;
    }
    router.push("/");
  };

  const submitSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 10) {
      setError("EL NOMBRE DEBE TENER ENTRE 1 Y 10 CARACTERES.");
      return;
    }
    if (pass !== confirmPass) {
      setError("LAS CONTRASEÑAS NO COINCIDEN.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: { data: { name: trimmedName } },
    });
    setLoading(false);
    if (error) {
      setError(translateAuthError(error.message));
      return;
    }
    router.push("/");
  };

  const signInWithOAuth = async (provider: "google" | "github") => {
    setError(null);
    setOauthLoading(provider);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(translateAuthError(error.message));
      setOauthLoading(null);
    }
    // En éxito el navegador redirige fuera de la app; no hace falta más lógica aquí.
  };

  if (user) {
    return (
      <div className="av-auth-wrap fade-in">
        <div className="auth-card">
          <div className="auth-header">
            <div className="mark"></div>
            <h2 className="neon-cyan">ARCADE VAULT</h2>
          </div>
          <div
            className="mono"
            style={{ textAlign: "center", fontSize: 13, marginTop: 4 }}
          >
            Ya iniciaste sesión como{" "}
            <span className="neon-yellow">{user.name}</span>
          </div>
          <button
            className="btn lg"
            style={{ width: "100%", marginTop: 20 }}
            onClick={() => router.push("/")}
          >
            IR AL VAULT
          </button>
          <button
            className="btn ghost"
            style={{ width: "100%", marginTop: 10 }}
            onClick={logout}
          >
            CERRAR SESIÓN
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        <div className="auth-tabs">
          <button
            className={tab === "in" ? "on" : ""}
            onClick={() => switchTab("in")}
          >
            INICIAR SESIÓN
          </button>
          <button
            className={tab === "up" ? "on" : ""}
            onClick={() => switchTab("up")}
          >
            CREAR CUENTA
          </button>
        </div>

        {tab === "in" ? (
          <form onSubmit={submitSignIn}>
            <div className="field">
              <label>Correo electrónico</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jugador@vault.gg"
              />
            </div>
            <div className="field">
              <label>Contraseña</label>
              <input
                type="password"
                required
                minLength={6}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button
              className="btn lg"
              type="submit"
              disabled={loading}
              style={{ width: "100%", marginTop: 8 }}
            >
              {loading ? "ENTRANDO..." : "ENTRAR AL VAULT"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitSignUp}>
            <div className="field slide-in">
              <label>Nombre de usuario</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 10))}
                maxLength={10}
                required
                placeholder="PX_KAI"
              />
            </div>
            <div className="field slide-in">
              <label>Correo electrónico</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jugador@vault.gg"
              />
            </div>
            <div className="field">
              <label>Contraseña</label>
              <input
                type="password"
                required
                minLength={6}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="field slide-in">
              <label>Confirmar contraseña</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button
              className="btn lg"
              type="submit"
              disabled={loading}
              style={{ width: "100%", marginTop: 8 }}
            >
              {loading ? "CREANDO CUENTA..." : "CREAR Y JUGAR"}
            </button>
          </form>
        )}

        {error && <div className="toast-saved">▸ {error}</div>}

        <button
          className="btn ghost"
          style={{ width: "100%", marginTop: 10 }}
          onClick={() => {
            logout();
            router.push("/");
          }}
        >
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button
            className="btn ghost"
            type="button"
            disabled={oauthLoading !== null}
            onClick={() => signInWithOAuth("google")}
          >
            ◆ {oauthLoading === "google" ? "CONECTANDO..." : "GOOGLE"}
          </button>
          <button
            className="btn ghost"
            type="button"
            disabled={oauthLoading !== null}
            onClick={() => signInWithOAuth("github")}
          >
            ▣ {oauthLoading === "github" ? "CONECTANDO..." : "GITHUB"}
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
