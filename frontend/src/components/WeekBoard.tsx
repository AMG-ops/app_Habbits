import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import type { CellState, Habit, HabitInput, WeekGrid } from "../api";
import { addDays, todayISO, weekStartISO, shortDay, parseISO, WEEKDAYS } from "../format";
import HabitForm from "./HabitForm";

interface Props {
  ownerId: string;
  readOnly?: boolean;
  empty: React.ReactNode;
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4.5 12.4 9.2 17.2 19.4 6.3"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Cross() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5.5 5.5 18.5 18.5M18.5 5.5 5.5 18.5"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Flame() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2c1 3-3 4.5-3 8a3 3 0 0 0 6 0c1.5 1 2 2.7 2 4a5 5 0 0 1-10 0c0-4 2-5.5 3-8 .5 1.5 1.3 1.8 2 1-1-1.8 0-3.6 0-5Z" />
    </svg>
  );
}

const RING_R = 42;
const RING_C = 2 * Math.PI * RING_R;

function Ring({ pct }: { pct: number | null }) {
  const fraction = pct === null ? 0 : Math.max(0, Math.min(100, pct)) / 100;
  return (
    <div className="ring-wrap">
      <svg className="ring" viewBox="0 0 100 100">
        <circle className="ring__track" cx="50" cy="50" r={RING_R} />
        <circle
          className="ring__value"
          cx="50"
          cy="50"
          r={RING_R}
          strokeDasharray={`${fraction * RING_C} ${RING_C}`}
        />
      </svg>
      <span className="ring__label">{pct === null ? "—" : `${pct}%`}</span>
    </div>
  );
}

function cellIcon(state: CellState) {
  if (state === "done") return <Check />;
  if (state === "missed") return <Cross />;
  return null;
}

export default function WeekBoard({ ownerId, readOnly = false, empty }: Props) {
  const [weekStart, setWeekStart] = useState(() => weekStartISO(todayISO()));
  const [grid, setGrid] = useState<WeekGrid | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addBusy, setAddBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await api.week(ownerId, weekStart, todayISO());
      setGrid(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chargement impossible.");
    }
  }, [ownerId, weekStart]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(habit: Habit, day: string) {
    if (readOnly || !grid) return;
    const cell = grid.cells[habit.id]?.[day];
    if (!cell || cell.state === "na") return;

    const willComplete = cell.state !== "done";
    const target = habit.target_type === "quantity" ? Number(habit.target_value) : 1;
    const key = `${habit.id}:${day}`;

    setGrid((current) => {
      if (!current) return current;
      const fallback: CellState = day > current.today ? "future" : day === current.today ? "pending" : "missed";
      return {
        ...current,
        cells: {
          ...current.cells,
          [habit.id]: {
            ...current.cells[habit.id],
            [day]: { value: willComplete ? String(target) : "0", state: willComplete ? "done" : fallback },
          },
        },
      };
    });

    setBusyKey(key);
    try {
      if (willComplete) await api.logEntry(habit.id, day, target);
      else await api.clearEntry(habit.id, day);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
      await load();
    } finally {
      setBusyKey(null);
    }
  }

  async function createHabit(input: HabitInput) {
    setAddBusy(true);
    setError(null);
    try {
      await api.createHabit(input);
      setAdding(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setAddBusy(false);
    }
  }

  const categories = useMemo(
    () =>
      Array.from(
        new Set((grid?.habits ?? []).map((h) => h.category).filter((c): c is string => !!c)),
      ),
    [grid],
  );

  const visibleHabits = useMemo(
    () => (grid?.habits ?? []).filter((h) => !categoryFilter || h.category === categoryFilter),
    [grid, categoryFilter],
  );

  const { todayPct, weekPct, bestStreak, doneToday, applicableToday, dayRatios } = useMemo(() => {
    if (!grid) {
      return {
        todayPct: null as number | null,
        weekPct: null as number | null,
        bestStreak: 0,
        doneToday: 0,
        applicableToday: 0,
        dayRatios: {} as Record<string, number | null>,
      };
    }
    let doneT = 0;
    let applicableT = 0;
    let doneW = 0;
    let applicableW = 0;
    const ratios: Record<string, number | null> = {};

    for (const day of grid.days) {
      let doneDay = 0;
      let applicableDay = 0;
      for (const habit of grid.habits) {
        const cell = grid.cells[habit.id]?.[day];
        if (!cell || cell.state === "na") continue;
        if (day === grid.today) {
          applicableT++;
          if (cell.state === "done") doneT++;
        }
        if (cell.state === "future") continue;
        applicableW++;
        applicableDay++;
        if (cell.state === "done") {
          doneW++;
          doneDay++;
        }
      }
      ratios[day] = applicableDay ? doneDay / applicableDay : null;
    }

    return {
      todayPct: applicableT ? Math.round((doneT / applicableT) * 100) : null,
      weekPct: applicableW ? Math.round((doneW / applicableW) * 100) : null,
      bestStreak: Math.max(0, ...Object.values(grid.streaks)),
      doneToday: doneT,
      applicableToday: applicableT,
      dayRatios: ratios,
    };
  }, [grid]);

  if (grid === null) {
    return error ? <p className="notice">{error}</p> : null;
  }

  const isCurrentWeek = weekStart === weekStartISO(todayISO());
  const rangeLabel = `${shortDay(grid.days[0])} – ${shortDay(grid.days[6])} ${
    ["jan.", "fév.", "mar.", "avr.", "mai", "juin", "juil.", "août", "sep.", "oct.", "nov.", "déc."][
      Number(grid.days[6].slice(5, 7)) - 1
    ]
  }`;

  return (
    <>
      {error && <p className="notice">{error}</p>}

      <div className="week-head">
        <div className="week-nav">
          <button
            type="button"
            className="btn btn--quiet btn--round"
            aria-label="Semaine précédente"
            onClick={() => setWeekStart((s) => addDays(s, -7))}
          >
            ‹
          </button>
          <span className="week-nav__label">
            {isCurrentWeek ? "Cette semaine" : rangeLabel}
          </span>
          <button
            type="button"
            className="btn btn--quiet btn--round"
            aria-label="Semaine suivante"
            onClick={() => setWeekStart((s) => addDays(s, 7))}
          >
            ›
          </button>
          {!isCurrentWeek && (
            <button
              type="button"
              className="chip"
              onClick={() => setWeekStart(weekStartISO(todayISO()))}
            >
              Aujourd'hui
            </button>
          )}
        </div>

        {!readOnly && (
          <button type="button" className="btn" onClick={() => setAdding(true)}>
            + Habitude
          </button>
        )}
      </div>

      {adding && (
        <div className="modal-backdrop" onClick={() => !addBusy && setAdding(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <HabitForm
              busy={addBusy}
              categories={categories}
              onSubmit={createHabit}
              onCancel={() => setAdding(false)}
            />
          </div>
        </div>
      )}

      {grid.habits.length === 0 ? (
        empty
      ) : (
        <>
          <div className="panel summary">
            <Ring pct={todayPct} />
            <div className="stats">
              <div className="stat">
                <span className="stat__value">
                  {applicableToday ? `${doneToday}/${applicableToday}` : "—"}
                </span>
                <span className="stat__label">fait aujourd'hui</span>
              </div>
              <div className="stat">
                <span className="stat__value">{weekPct === null ? "—" : `${weekPct}%`}</span>
                <span className="stat__label">cette semaine</span>
              </div>
              <div className="stat">
                <span className="stat__value">
                  {bestStreak > 0 ? (
                    <span className="streak streak--lg">
                      <Flame /> {bestStreak}
                    </span>
                  ) : (
                    "—"
                  )}
                </span>
                <span className="stat__label">meilleure série</span>
              </div>
            </div>

            <div className="heat">
              {grid.days.map((day) => {
                const ratio = dayRatios[day];
                const isToday = day === grid.today;
                return (
                  <div className="heat__day" key={day}>
                    <div className="heat__bar">
                      {ratio !== null && (
                        <span style={{ height: `${Math.round(ratio * 100)}%` }} />
                      )}
                    </div>
                    <span className={`heat__label${isToday ? " heat__label--today" : ""}`}>
                      {WEEKDAYS[(parseISO(day).getDay() + 6) % 7].short}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {categories.length > 0 && (
            <div className="chips" style={{ marginBottom: "1rem" }}>
              <button
                type="button"
                className="chip"
                aria-pressed={categoryFilter === null}
                onClick={() => setCategoryFilter(null)}
              >
                Toutes
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="chip"
                  aria-pressed={categoryFilter === c}
                  onClick={() => setCategoryFilter(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          <div className="week-scroll">
            <div className="week-table">
              <div className="week-table__corner" />
              {grid.days.map((day) => (
                <div
                  key={day}
                  className={`week-table__day${day === grid.today ? " week-table__day--today" : ""}`}
                >
                  <span className="week-table__weekday">
                    {WEEKDAYS[(parseISO(day).getDay() + 6) % 7].short}
                  </span>
                  <span className="week-table__date">{shortDay(day)}</span>
                </div>
              ))}

              {visibleHabits.map((habit) => {
                const streak = grid.streaks[habit.id] ?? 0;
                return (
                  <Fragment key={habit.id}>
                    <div
                      className="week-table__name"
                      style={{ ["--teinte" as string]: `var(--${habit.color})` }}
                    >
                      <span className="week-table__dot" aria-hidden="true" />
                      <span className="week-table__label">{habit.name}</span>
                      {streak > 0 && (
                        <span className="streak">
                          <Flame />
                          {streak}
                        </span>
                      )}
                    </div>
                    {grid.days.map((day) => {
                      const cell = grid.cells[habit.id]?.[day];
                      if (!cell) return <div key={`${habit.id}-${day}`} className="wcell wcell--na" />;
                      const busy = busyKey === `${habit.id}:${day}`;
                      return (
                        <button
                          key={`${habit.id}-${day}`}
                          type="button"
                          className={`wcell wcell--${cell.state}${day === grid.today ? " wcell--today" : ""}`}
                          disabled={readOnly || cell.state === "na" || busy}
                          aria-label={`${habit.name} — ${day}`}
                          aria-pressed={cell.state === "done"}
                          onClick={() => toggle(habit, day)}
                        >
                          <span className="wcell__mark">{cellIcon(cell.state)}</span>
                        </button>
                      );
                    })}
                  </Fragment>
                );
              })}
            </div>
          </div>

          <div className="week-legend">
            <span className="week-legend__item">
              <span className="week-legend__mark week-legend__mark--done" /> Fait
            </span>
            <span className="week-legend__item">
              <span className="week-legend__mark week-legend__mark--missed" /> Manqué
            </span>
            <span className="week-legend__item">
              <span className="week-legend__mark week-legend__mark--pending" /> À faire
            </span>
            <span className="week-legend__item">– Non prévu ce jour-là</span>
          </div>
        </>
      )}
    </>
  );
}
