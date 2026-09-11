import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { HabitState, HabitStatus } from "../api";
import { todayISO } from "../format";
import HabitRow from "./HabitRow";

const SECTIONS: { state: HabitState; name: string; modifier?: string }[] = [
  { state: "late", name: "En retard", modifier: "section--late" },
  { state: "due_today", name: "Aujourd'hui" },
  { state: "open", name: "En cours" },
  { state: "done", name: "Fait" },
];

interface Props {
  ownerId: string;
  readOnly?: boolean;
  /** Rendered when the owner tracks nothing at all. */
  empty: React.ReactNode;
}

export default function TodayBoard({ ownerId, readOnly = false, empty }: Props) {
  const [statuses, setStatuses] = useState<HabitStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStatuses(await api.today(ownerId, todayISO()));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chargement impossible.");
    }
  }, [ownerId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function log(habitId: string, value: number | null) {
    setBusyId(habitId);
    try {
      if (value === null || value <= 0) {
        await api.clearEntry(habitId, todayISO());
      } else {
        await api.logEntry(habitId, todayISO(), value);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setBusyId(null);
    }
  }

  if (statuses === null) {
    return error ? <p className="notice">{error}</p> : null;
  }

  if (statuses.length === 0) return <>{empty}</>;

  return (
    <>
      {error && <p className="notice">{error}</p>}
      {SECTIONS.map(({ state, name, modifier }) => {
        const rows = statuses.filter((status) => status.state === state);
        if (rows.length === 0) return null;
        return (
          <section key={state} className={`section ${modifier ?? ""}`}>
            <h2 className="section__head">
              <span className="section__name">{name}</span>
              <span className="section__count">{rows.length}</span>
            </h2>
            <ul className="rows">
              {rows.map((status) => (
                <HabitRow
                  key={status.habit.id}
                  status={status}
                  readOnly={readOnly}
                  busy={busyId === status.habit.id}
                  onLog={(value) => log(status.habit.id, value)}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
