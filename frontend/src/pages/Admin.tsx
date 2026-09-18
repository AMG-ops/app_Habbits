import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { AdminUser } from "../api";
import { longDate, isoDate } from "../format";

export default function Admin() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .adminUsers()
      .then(setUsers)
      .catch((err) => setError(err instanceof Error ? err.message : "Chargement impossible."));
  }, []);

  return (
    <>
      <h1 className="page-title">Administration</h1>
      <p className="page-lede">
        Tous les comptes de la plateforme. En tant qu'administrateur, tu peux consulter le
        suivi de n'importe qui, quel que soit le partage.
      </p>

      {error && <p className="notice">{error}</p>}

      {users && (
        <ul className="people">
          {users.map((person) => (
            <li key={person.id} className="person">
              <span
                className="person__dot"
                style={{ background: `var(--${person.accent})` }}
                aria-hidden="true"
              />
              <span>
                <span className="person__name">
                  {person.display_name}
                  {person.is_admin && (
                    <span className="chip" style={{ marginLeft: "0.5rem" }}>
                      admin
                    </span>
                  )}
                </span>
                <br />
                <span className="person__email">
                  {person.email} · {person.habit_count}{" "}
                  {person.habit_count > 1 ? "habitudes" : "habitude"} · inscrit·e le{" "}
                  {longDate(isoDate(new Date(person.created_at)))}
                </span>
              </span>
              <Link to={`/cercle/${person.id}`} className="chip spacer">
                Voir son suivi
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
