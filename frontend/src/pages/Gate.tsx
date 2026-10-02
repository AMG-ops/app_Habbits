import { useState } from "react";
import { ACCENTS, api } from "../api";
import type { Accent } from "../api";
import { useAuth } from "../auth";

type Mode = "signin" | "signup" | "forgot" | "reset";

export default function Gate() {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [accent, setAccent] = useState<Accent>("bleu");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function switchTo(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        await signUp({ email, password, display_name: displayName, accent });
      } else if (mode === "signin") {
        await signIn(email, password);
      } else if (mode === "forgot") {
        await api.forgotPassword(email);
        setNotice("Si ce compte existe, un code vient d'être envoyé par e-mail. Il est valable 15 minutes.");
        setMode("reset");
      } else {
        await resetPassword({ email, code, new_password: newPassword });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gate">
      <h1 className="gate__mark">Habitude</h1>
      <p className="gate__lede">
        Le suivi des tâches qui reviennent : chaque jour, chaque semaine, chaque mois,
        chaque année.
      </p>

      {error && <p className="notice">{error}</p>}
      {notice && <p className="notice notice--ok">{notice}</p>}

      <form onSubmit={submit}>
        {mode === "signup" && (
          <>
            <label className="field">
              <span className="field__label">Ton prénom</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                maxLength={80}
                autoComplete="given-name"
              />
            </label>

            <div className="field">
              <span className="field__label">Ta couleur</span>
              <div className="chips">
                {ACCENTS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className="swatch"
                    aria-pressed={accent === value}
                    aria-label={value}
                    onClick={() => setAccent(value)}
                  >
                    <span style={{ background: `var(--${value})` }} />
                  </button>
                ))}
              </div>
              <p className="field__hint">
                Elle te distingue des autres quand vous partagez votre suivi.
              </p>
            </div>
          </>
        )}

        <label className="field">
          <span className="field__label">Adresse e-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>

        {(mode === "signin" || mode === "signup") && (
          <label className="field">
            <span className="field__label">Mot de passe</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "signup" ? 8 : undefined}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
            {mode === "signup" && <p className="field__hint">Huit caractères au minimum.</p>}
          </label>
        )}

        {mode === "reset" && (
          <>
            <label className="field">
              <span className="field__label">Code reçu par e-mail</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
                autoComplete="one-time-code"
                placeholder="123456"
              />
            </label>
            <label className="field">
              <span className="field__label">Nouveau mot de passe</span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
              <p className="field__hint">Huit caractères au minimum.</p>
            </label>
          </>
        )}

        <div className="btn-row">
          <button type="submit" className="btn" disabled={busy}>
            {mode === "signup"
              ? "Créer mon compte"
              : mode === "signin"
                ? "Me connecter"
                : mode === "forgot"
                  ? "Envoyer le code"
                  : "Changer le mot de passe"}
          </button>

          {mode === "signin" && (
            <button type="button" className="btn btn--quiet" onClick={() => switchTo("signup")}>
              Créer un compte
            </button>
          )}
          {mode === "signup" && (
            <button type="button" className="btn btn--quiet" onClick={() => switchTo("signin")}>
              J'ai déjà un compte
            </button>
          )}
          {(mode === "forgot" || mode === "reset") && (
            <button type="button" className="btn btn--quiet" onClick={() => switchTo("signin")}>
              Retour à la connexion
            </button>
          )}
        </div>

        {mode === "signin" && (
          <p className="field__hint" style={{ marginTop: "0.75rem" }}>
            <button type="button" className="link-button" onClick={() => switchTo("forgot")}>
              Mot de passe oublié ?
            </button>
          </p>
        )}
        {mode === "reset" && (
          <p className="field__hint" style={{ marginTop: "0.75rem" }}>
            <button type="button" className="link-button" onClick={() => switchTo("forgot")}>
              Pas reçu de code ? Recommencer
            </button>
          </p>
        )}
      </form>
    </div>
  );
}
