import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { longDate, todayISO } from "./format";
import Gate from "./pages/Gate";
import Today from "./pages/Today";
import Year from "./pages/Year";
import Habits from "./pages/Habits";
import Circle from "./pages/Circle";
import Watch from "./pages/Watch";
import Account from "./pages/Account";

function Masthead() {
  const { user } = useAuth();
  const today = longDate(todayISO());

  return (
    <header className="masthead">
      <div className="masthead__top">
        <NavLink to="/" className="wordmark">
          Habitude
        </NavLink>
        <span className="masthead__date">
          {today}
          {user ? ` · ${user.display_name}` : ""}
        </span>
      </div>
      <nav className="nav" aria-label="Sections">
        <NavLink to="/" end>
          Aujourd'hui
        </NavLink>
        <NavLink to="/annee">L'année</NavLink>
        <NavLink to="/habitudes">Mes habitudes</NavLink>
        <NavLink to="/cercle">Mon cercle</NavLink>
        <NavLink to="/compte">Mon compte</NavLink>
      </nav>
    </header>
  );
}

export default function App() {
  const { user, ready } = useAuth();

  if (!ready) return null;
  if (!user) return <Gate />;

  return (
    <div className="shell">
      <Masthead />
      <main>
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/annee" element={<Year />} />
          <Route path="/habitudes" element={<Habits />} />
          <Route path="/cercle" element={<Circle />} />
          <Route path="/cercle/:ownerId" element={<Watch />} />
          <Route path="/compte" element={<Account />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
