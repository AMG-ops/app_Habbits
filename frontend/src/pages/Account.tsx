import { useState } from "react";
import { ACCENTS, api } from "../api";
import type { Accent } from "../api";
import { useAuth } from "../auth";

export default function Account() {
  const { user, refresh, signOut } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [accent, setAccent] = useState<Accent>(user?.accent ?? "bleu");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      refresh(await api.updateMe({ display_name: displayName, accent }));
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="page-title">Mon compte</h1>
      <p className="page-lede">
        Ton prénom et ta couleur apparaissent aux personnes avec qui tu partages ton suivi.
      </p>

      {error && <p className="notice">{error}</p>}
      {done && <p className="notice notice--ok">Modifications enregistrées.</p>}

      <form className="panel" onSubmit={save} style={{ maxWidth: "24rem" }}>
        <label className="field">
          <span className="field__label">Prénom</span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            maxLength={80}
          />
        </label>

        <div className="field">
          <span className="field__label">Couleur</span>
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
        </div>

        <p className="field__hint" style={{ marginBottom: "1rem" }}>
          Connecté avec {user.email}
        </p>

        <div className="btn-row">
          <button type="submit" className="btn" disabled={busy}>
            Enregistrer
          </button>
          <button type="button" className="btn btn--quiet" onClick={signOut}>
            Me déconnecter
          </button>
        </div>
      </form>
    </>
  );
}
