import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import type { User } from "../api";
import PlannerBoard from "../components/PlannerBoard";
import TodayBoard from "../components/TodayBoard";

export default function Watch() {
  const { ownerId } = useParams<{ ownerId: string }>();
  const [person, setPerson] = useState<User | null>(null);

  useEffect(() => {
    api
      .circle()
      .then((circle) => setPerson(circle.shared_by.find((u) => u.id === ownerId) ?? null))
      .catch(() => setPerson(null));
  }, [ownerId]);

  if (!ownerId) return null;

  return (
    <>
      <h1 className="page-title">
        {person ? `Le suivi de ${person.display_name}` : "Suivi partagé"}
      </h1>
      <p className="page-lede">
        Lecture seule. <Link to="/cercle">Retour à mon cercle</Link>
      </p>

      <TodayBoard
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
