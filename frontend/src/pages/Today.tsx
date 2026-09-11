import { Link } from "react-router-dom";
import TodayBoard from "../components/TodayBoard";
import { useAuth } from "../auth";

export default function Today() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <>
      <h1 className="page-title">Aujourd'hui</h1>
      <p className="page-lede">
        Ce qui attend une marque, du plus pressé au plus tranquille. Tu peux aussi cocher
        une date passée depuis <Link to="/annee">l'année</Link>.
      </p>

      <TodayBoard
        ownerId={user.id}
        empty={
          <div className="empty">
            <h3>Rien à suivre pour l'instant</h3>
            <p>
              Crée ta première habitude : une tâche qui revient chaque jour, chaque semaine,
              chaque mois ou chaque année.
            </p>
            <p>
              <Link to="/habitudes" className="btn">
                Créer une habitude
              </Link>
            </p>
          </div>
        }
      />
    </>
  );
}
