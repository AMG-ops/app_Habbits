import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { Circle as CircleData } from "../api";

export default function Circle() {
  const [circle, setCircle] = useState<CircleData | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setCircle(await api.circle());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chargement impossible.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function share(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const person = await api.shareWith(email);
      setDone(`${person.display_name} peut maintenant consulter ton suivi.`);
      setEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Partage impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(viewerId: string) {
    try {
      await api.stopSharing(viewerId);
      setDone(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retrait impossible.");
    }
  }

  return (
    <>
      <h1 className="page-title">Mon cercle</h1>
      <p className="page-lede">
        Partager ton suivi donne un droit de lecture, jamais d'écriture : personne ne peut
        cocher à ta place, et tu peux retirer l'accès quand tu veux.
      </p>

      {error && <p className="notice">{error}</p>}
      {done && <p className="notice notice--ok">{done}</p>}

      <section className="section">
        <h2 className="section__head">
          <span className="section__name">Partager mon suivi</span>
        </h2>
        <form onSubmit={share} style={{ marginTop: "1rem", maxWidth: "24rem" }}>
          <label className="field">
            <span className="field__label">Adresse e-mail de la personne</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="alice@exemple.fr"
            />
            <p className="field__hint">
              Elle doit déjà avoir un compte Habitude.
            </p>
          </label>
          <button type="submit" className="btn" disabled={busy}>
            Donner l'accès
          </button>
        </form>
      </section>

      <section className="section">
        <h2 className="section__head">
          <span className="section__name">Voient mon suivi</span>
          <span className="section__count">{circle?.shared_with.length ?? 0}</span>
        </h2>
        {circle && circle.shared_with.length === 0 ? (
          <p className="empty">Personne pour l'instant.</p>
        ) : (
          <ul className="people">
            {circle?.shared_with.map((person) => (
              <li key={person.id} className="person">
                <span
                  className="person__dot"
                  style={{ background: `var(--${person.accent})` }}
                  aria-hidden="true"
                />
                <span>
                  <span className="person__name">{person.display_name}</span>
                  <br />
                  <span className="person__email">{person.email}</span>
                </span>
                <button
                  type="button"
                  className="chip spacer"
                  onClick={() => revoke(person.id)}
                >
                  Retirer l'accès
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section">
        <h2 className="section__head">
          <span className="section__name">Je peux suivre</span>
          <span className="section__count">{circle?.shared_by.length ?? 0}</span>
        </h2>
        {circle && circle.shared_by.length === 0 ? (
          <p className="empty">
            Personne ne t'a encore partagé son suivi. Demande-lui de t'ajouter depuis son
            propre cercle.
          </p>
        ) : (
          <ul className="people">
            {circle?.shared_by.map((person) => (
              <li key={person.id} className="person">
                <span
                  className="person__dot"
                  style={{ background: `var(--${person.accent})` }}
                  aria-hidden="true"
                />
                <span className="person__name">{person.display_name}</span>
                <Link to={`/cercle/${person.id}`} className="chip spacer">
                  Voir son suivi
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
