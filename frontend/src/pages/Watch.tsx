import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import type { User } from "../api";
import { useAuth } from "../auth";
import PlannerBoard from "../components/PlannerBoard";
import WeekBoard from "../components/WeekBoard";

export default function Watch() {
  const { ownerId } = useParams<{ ownerId: string }>();
  const { user } = useAuth();
  const [person, setPerson] = useState<User | null>(null);

  useEffect(() => {
    api
      .circle()
      .then(async (circle) => {
        const known = circle.shared_by.find((u) => u.id === ownerId) ?? null;
        if (known || !user?.is_admin) return known;
        const everyone = await api.adminUsers();
        return everyone.find((u) => u.id === ownerId) ?? null;
      })
      .then(setPerson)
      .catch(() => setPerson(null));
  }, [ownerId, user?.is_admin]);

  if (!ownerId) return null;

  return (
    <>
      <h1 className="page-title">
        {person ? `Le suivi de ${person.display_name}` : "Suivi partagé"}
      </h1>
      <p className="page-lede">
        Lecture seule. <Link to="/cercle">Retour à mon cercle</Link>
      </p>

      <WeekBoard
        ownerId={ownerId}
        readOnly
        empty={<p className="empty">Rien de suivi pour l'instant.</p>}
      />

      <section className="section">
        <h2 className="section__head">
          <span className="section__name">Son année</span>
        </h2>
        <div style={{ marginTop: "1rem" }}>
          <PlannerBoard ownerId={ownerId} readOnly />
        </div>
      </section>
    </>
  );
}
