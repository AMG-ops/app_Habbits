import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { YearGrid } from "../api";
import { cadenceLabel } from "../format";
import Planner from "./Planner";

interface Props {
  ownerId: string;
  readOnly?: boolean;
}

export default function PlannerBoard({ ownerId, readOnly = false }: Props) {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [habitId, setHabitId] = useState<string | null>(null);
  const [grid, setGrid] = useState<YearGrid | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await api.grid(ownerId, year);
      setGrid(next);
      setError(null);
      // Keep the selection valid if the habit disappeared.
      setHabitId((current) =>
        current && next.habits.some((h) => h.id === current) ? current : null,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chargement impossible.");
    }
  }, [ownerId, year]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(id: string, day: string, next: boolean) {
    try {
      if (next) await api.logEntry(id, day);
      else await api.clearEntry(id, day);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    }
  }

  if (!grid) return error ? <p className="notice">{error}</p> : null;

  if (grid.habits.length === 0) {
    return (
      <div className="empty">
        <h3>Le planning est vierge</h3>
        <p>Il se remplira dès qu'une habitude sera suivie.</p>
      </div>
    );
  }

  const selected = habitId ? grid.habits.find((h) => h.id === habitId) : null;
  const total = selected
    ? Object.keys(grid.entries[selected.id] ?? {}).length
    : Object.values(grid.day_counts).reduce((sum, n) => sum + n, 0);

  return (
    <>
      {error && <p className="notice">{error}</p>}

      <div className="btn-row" style={{ marginBottom: "1rem" }}>
        <button type="button" className="chip" onClick={() => setYear((y) => y - 1)}>
          ← {year - 1}
        </button>
        <strong style={{ fontFamily: "var(--display)", fontSize: "var(--t-lg)" }}>
          {year}
        </strong>
        <button
          type="button"
          className="chip"
          onClick={() => setYear((y) => y + 1)}
          disabled={year >= new Date().getFullYear()}
        >
          {year + 1} →
        </button>
      </div>

      <div className="chips" style={{ marginBottom: "1rem" }}>
        <button
          type="button"
          className="chip"
          aria-pressed={habitId === null}
          onClick={() => setHabitId(null)}
        >
          Toutes
        </button>
        {grid.habits.map((habit) => (
          <button
            key={habit.id}
            type="button"
            className="chip"
            aria-pressed={habitId === habit.id}
            onClick={() => setHabitId(habit.id)}
          >
            {habit.name}
          </button>
        ))}
      </div>

      <p className="page-lede" style={{ marginBottom: "1rem" }}>
        {selected ? (
          <>
            {cadenceLabel(selected)} — {total} {total > 1 ? "jours notés" : "jour noté"} en{" "}
            {year}.{" "}
            {!readOnly && "Clique une case pour cocher ou décocher cette date."}
          </>
        ) : (
          <>
            {total} marques posées en {year}, toutes habitudes confondues. Choisis une
            habitude pour la corriger jour par jour.
          </>
        )}
      </p>

      <Planner grid={grid} habitId={habitId} readOnly={readOnly} onToggle={toggle} />
    </>
  );
}
