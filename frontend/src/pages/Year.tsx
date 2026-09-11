import PlannerBoard from "../components/PlannerBoard";
import { useAuth } from "../auth";

export default function Year() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <>
      <h1 className="page-title">L'année</h1>
      <p className="page-lede">
        Le planning mural : douze mois en colonnes, trente-et-un jours en lignes. Les
        week-ends sont teintés, le jour même est encadré.
      </p>
      <PlannerBoard ownerId={user.id} />
    </>
  );
}
