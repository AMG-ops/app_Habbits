import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { Habit, HabitInput } from "../api";
import HabitForm from "../components/HabitForm";
import { cadenceLabel } from "../format";

export default function Habits() {
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [editing, setEditing] = useState<Habit | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setHabits(await api.habits());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chargement impossible.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(input: HabitInput) {
    setBusy(true);
    setError(null);
    try {
      if (editing === "new") await api.createHabit(input);
      else if (editing) await api.updateHabit(editing.id, input);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(habit: Habit) {
    const sure = window.confirm(
      `Supprimer « ${habit.name} » et tout son historique ? C'est définitif.`,
    );
    if (!sure) return;
    try {
      await api.deleteHabit(habit.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible.");
    }
  }

  return (
    <>
      <h1 className="page-title">Mes habitudes</h1>
      <p className="page-lede">
        Une habitude, c'est un nom, un rythme et une manière de la mesurer. Tout se
        modifie après coup sans perdre l'historique.
      </p>

      {error && <p className="notice">{error}</p>}

      {editing === null && (
        <p className="btn-row" style={{ marginBottom: "1.5rem" }}>
          <button type="button" className="btn" onClick={() => setEditing("new")}>
            Nouvelle habitude
          </button>
        </p>
      )}

      {editing !== null && (
        <HabitForm
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? undefined : editing}
          busy={busy}
          onSubmit={save}
          onCancel={() => setEditing(null)}
        />
      )}

      {habits && habits.length === 0 && editing === null && (
        <div className="empty">
          <h3>Aucune habitude</h3>
          <p>
            Commence par la plus évidente : celle que tu oublies le plus souvent.
          </p>
        </div>
      )}

      {habits && habits.length > 0 && (
        <ul className="rows">
          {habits.map((habit) => (
            <li key={habit.id} className="row">
              <span
                className="person__dot"
                style={{ background: `var(--${habit.color})` }}
                aria-hidden="true"
              />
              <div className="row__body">
                <div className="row__name">{habit.name}</div>
                <div className="row__meta">
                  <span>{cadenceLabel(habit)}</span>
                  {habit.note && <span>{habit.note}</span>}
                </div>
              </div>
              <div className="btn-row">
                <button
                  type="button"
                  className="chip"
                  onClick={() => setEditing(habit)}
                >
                  Modifier
                </button>
                <button
                  type="button"
                  className="chip"
                  onClick={() => remove(habit)}
                >
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
