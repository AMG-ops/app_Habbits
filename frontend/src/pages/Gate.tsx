import { useState } from "react";
import { ACCENTS } from "../api";
import type { Accent } from "../api";
import { useAuth } from "../auth";

export default function Gate() {
  const { signIn, signUp } = useAuth();
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [accent, setAccent] = useState<Accent>("bleu");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (creating) {
        await signUp({ email, password, display_name: displayName, accent });
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible.");
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

      <form onSubmit={submit}>
        {creating && (
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

        <label className="field">
          <span className="field__label">Mot de passe</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={creating ? 8 : undefined}
            autoComplete={creating ? "new-password" : "current-password"}
          />
          {creating && <p className="field__hint">Huit caractères au minimum.</p>}
        </label>

        <div className="btn-row">
          <button type="submit" className="btn" disabled={busy}>
            {creating ? "Créer mon compte" : "Me connecter"}
          </button>
          <button
            type="button"
            className="btn btn--quiet"
            onClick={() => {
              setCreating((value) => !value);
              setError(null);
            }}
          >
            {creating ? "J'ai déjà un compte" : "Créer un compte"}
          </button>
        </div>
      </form>
    </div>
  );
}
