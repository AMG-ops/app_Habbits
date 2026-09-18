import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { Circle as CircleData, Habit } from "../api";

export default function Circle() {
  const [circle, setCircle] = useState<CircleData | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savingFor, setSavingFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [nextCircle, nextHabits] = await Promise.all([api.circle(), api.habits()]);
      setCircle(nextCircle);
      setHabits(nextHabits);
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
      setDone(`${person.display_name} est dans ton cercle. Choisis ce qu'elle peut voir ci-dessous.`);
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

  async function toggleHabit(viewerId: string, habitIds: string[], habitId: string) {
    const next = habitIds.includes(habitId)
      ? habitIds.filter((id) => id !== habitId)
      : [...habitIds, habitId];
    setSavingFor(viewerId);
    try {
      await api.setSharedHabits(viewerId, next);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mise à jour impossible.");
    } finally {
      setSavingFor(null);
    }
  }

  return (
    <>
      <h1 className="page-title">Mon cercle</h1>
      <p className="page-lede">
        Ajouter quelqu'un à ton cercle ne lui montre rien par défaut : tu choisis ensuite,
        habitude par habitude, ce qu'elle peut voir. Lecture seule, jamais d'écriture.
      </p>

      {error && <p className="notice">{error}</p>}
      {done && <p className="notice notice--ok">{done}</p>}

      <section className="section">
        <h2 className="section__head">
          <span className="section__name">Ajouter à mon cercle</span>
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
            Ajouter au cercle
          </button>
        </form>
      </section>

      <section className="section">
        <h2 className="section__head">
          <span className="section__name">Voient (une partie de) mon suivi</span>
          <span className="section__count">{circle?.shared_with.length ?? 0}</span>
        </h2>
        {circle && circle.shared_with.length === 0 ? (
          <p className="empty">Personne pour l'instant.</p>
        ) : (
          <ul className="people people--stacked">
            {circle?.shared_with.map(({ user: person, habit_ids }) => (
              <li key={person.id} className="person person--stacked">
                <div className="person">
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
                    Retirer du cercle
                  </button>
                </div>

                {habits.length === 0 ? (
                  <p className="field__hint">Tu n'as pas encore d'habitude à partager.</p>
                ) : (
                  <div className="chips habit-visibility">
                    {habits.map((habit) => (
                      <button
                        key={habit.id}
                        type="button"
                        className="chip"
                        aria-pressed={habit_ids.includes(habit.id)}
                        disabled={savingFor === person.id}
                        onClick={() => toggleHabit(person.id, habit_ids, habit.id)}
                      >
                        <span
                          className="person__dot"
                          style={{ background: `var(--${habit.color})`, marginRight: "0.4rem" }}
                          aria-hidden="true"
                        />
                        {habit.name}
                      </button>
                    ))}
                  </div>
                )}
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
