import { Link } from "react-router-dom";
import WeekBoard from "../components/WeekBoard";
import { useAuth } from "../auth";

export default function Today() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <>
      <h1 className="page-title">Cette semaine</h1>
      <p className="page-lede">
        Une case par jour, une ligne par habitude : tape pour cocher. Le détail par
        année reste dans <Link to="/annee">l'année</Link>.
      </p>

      <WeekBoard
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
