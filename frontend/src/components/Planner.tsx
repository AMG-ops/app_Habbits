import type { YearGrid } from "../api";
import { MONTHS, MONTHS_SHORT, isoDate, todayISO } from "../format";

interface Props {
  grid: YearGrid;
  /** null shows every habit at once, as a density of marks. */
  habitId: string | null;
  readOnly?: boolean;
  onToggle?: (habitId: string, day: string, next: boolean) => void;
}

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const MONTH_INDEXES = Array.from({ length: 12 }, (_, i) => i);

export default function Planner({ grid, habitId, readOnly = false, onToggle }: Props) {
  const today = todayISO();
  const habit = habitId ? grid.habits.find((h) => h.id === habitId) ?? null : null;
  const teinte = `var(--${habit?.color ?? "ardoise"})`;
  const marks = habitId ? grid.entries[habitId] ?? {} : null;
  const busiest = Math.max(grid.habits.length, 1);

  return (
    <>
      <div className="planner-scroll">
        <div
          className="planner"
          role="grid"
          aria-label={
            habit
              ? `Planning ${grid.year} pour ${habit.name}`
              : `Planning ${grid.year}, toutes les habitudes`
          }
        >
          <div className="planner__corner" role="columnheader">
            <span className="sr-only">Jour</span>
          </div>
          {MONTH_INDEXES.map((month) => (
            <div key={month} className="planner__month" role="columnheader">
              <abbr title={MONTHS[month]} style={{ textDecoration: "none" }}>
                {MONTHS_SHORT[month]}
              </abbr>
            </div>
          ))}

          {DAYS.map((day) => (
            <Row
              key={day}
              day={day}
              year={grid.year}
              today={today}
              marks={marks}
              counts={grid.day_counts}
              busiest={busiest}
              teinte={teinte}
              interactive={Boolean(habitId) && !readOnly}
              onToggle={(iso, next) => habitId && onToggle?.(habitId, iso, next)}
            />
          ))}
        </div>
      </div>

      <p className="planner-legend">
        <span className="planner-legend__swatch" />
        <span>rien noté</span>
        <span
          className="planner-legend__swatch"
          style={{ background: teinte, opacity: 0.45, borderColor: "transparent" }}
        />
        <span
          className="planner-legend__swatch"
          style={{ background: teinte, borderColor: "transparent" }}
        />
        <span>{habit ? "fait" : "de une à toutes les habitudes"}</span>
      </p>
    </>
  );
}

interface RowProps {
  day: number;
  year: number;
  today: string;
  marks: Record<string, string> | null;
  counts: Record<string, number>;
  busiest: number;
  teinte: string;
  interactive: boolean;
  onToggle: (day: string, next: boolean) => void;
}

function Row({
  day, year, today, marks, counts, busiest, teinte, interactive, onToggle,
}: RowProps) {
  return (
    <>
      <div className="planner__day" role="rowheader">
        {day}
      </div>
      {MONTH_INDEXES.map((month) => {
        const date = new Date(year, month, day);
        // A Date rolls over when the day does not exist in that month.
        if (date.getMonth() !== month) {
          return <div key={month} className="cell cell--void" aria-hidden="true" />;
        }

        const iso = isoDate(date);
        const weekend = date.getDay() === 0 || date.getDay() === 6;
        const filled = marks ? Boolean(marks[iso]) : false;
        const count = counts[iso] ?? 0;
        const opacity = marks ? 1 : count === 0 ? 0 : 0.35 + 0.65 * Math.min(count / busiest, 1);
        const show = marks ? filled : count > 0;

        const classes = [
          "cell",
          weekend ? "cell--weekend" : "",
          iso === today ? "cell--today" : "",
        ]
          .filter(Boolean)
          .join(" ");

        const label = `${day} ${MONTHS[month]} ${year}`;

        return (
          <button
            key={month}
            type="button"
            className={classes}
            role="gridcell"
            disabled={!interactive}
            aria-pressed={interactive ? filled : undefined}
            aria-label={interactive ? `${label} : ${filled ? "fait" : "non fait"}` : label}
            title={marks ? label : `${label} — ${count} sur ${busiest}`}
            onClick={() => interactive && onToggle(iso, !filled)}
          >
            {show && (
              <span
                className="cell__mark"
                style={{ ["--teinte" as string]: teinte, opacity }}
              />
            )}
          </button>
        );
      })}
    </>
  );
}
