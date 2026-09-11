import { useEffect, useState } from "react";
import type { HabitStatus } from "../api";
import { progressLabel, statusNote } from "../format";

interface Props {
  status: HabitStatus;
  busy: boolean;
  readOnly?: boolean;
  /** null clears the day, a number records it. */
  onLog: (value: number | null) => void;
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4.5 12.4 9.2 17.2 19.4 6.3"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function HabitRow({ status, busy, readOnly = false, onLog }: Props) {
  const { habit, done, progress, target, today_value } = status;
  const teinte = `var(--${habit.color})`;
  const ratio = Math.min(Number(progress) / Number(target), 1);
  const quantified = habit.target_type === "quantity";
  const current = Number(today_value);
  const note = statusNote(status);

  // The field is typed into freely; only blur or Enter reaches the server.
  const [draft, setDraft] = useState(String(current || ""));
  useEffect(() => setDraft(String(current || "")), [current]);

  function commitDraft() {
    const trimmed = draft.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    if (next !== null && Number.isNaN(next)) {
      setDraft(String(current || ""));
      return;
    }
    if (next === current || (next === null && current === 0)) return;
    onLog(next);
  }

  const mark = (
    <button
      type="button"
      className={`mark${done ? " mark--done" : ""}`}
      style={{ ["--teinte" as string]: teinte }}
      disabled={busy || readOnly}
      aria-pressed={done}
      aria-label={done ? `Annuler : ${habit.name}` : `Marquer comme fait : ${habit.name}`}
      onClick={() => onLog(done ? null : quantified ? Number(target) : 1)}
    >
      {!done && ratio > 0 && (
        <span className="mark__fill" style={{ height: `${ratio * 100}%` }} />
      )}
      {done && <Check />}
    </button>
  );

  return (
    <li className={`row${done ? " row--done" : ""}`}>
      {mark}
      <div className="row__body">
        <div className="row__name">{habit.name}</div>
        <div className="row__meta">
          {note && <span>{note}</span>}
          {quantified && <span>{progressLabel(status)}</span>}
          {status.missed_last_period && !done && <em>Période précédente manquée</em>}
        </div>
      </div>

      {quantified && !readOnly && habit.cadence === "daily" && (
        <div className="tally">
          <label className="sr-only" htmlFor={`v-${habit.id}`}>
            Valeur du jour pour {habit.name}
          </label>
          <input
            id={`v-${habit.id}`}
            type="number"
            min={0}
            step="any"
            value={draft}
            placeholder="0"
            disabled={busy}
            style={{ width: "5.5rem" }}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
          />
        </div>
      )}

      {quantified && !readOnly && habit.cadence !== "daily" && (
        <div className="tally">
          <button
            type="button"
            className="step"
            disabled={busy || current <= 0}
            aria-label={`Retirer une fois pour ${habit.name}`}
            onClick={() => onLog(current <= 1 ? null : current - 1)}
          >
            −
          </button>
          <span className="tally__value">
            <b>{Number(progress)}</b>/{Number(target)}
          </span>
          <button
            type="button"
            className="step"
            disabled={busy}
            aria-label={`Ajouter une fois pour ${habit.name}`}
            onClick={() => onLog(current + 1)}
          >
            +
          </button>
        </div>
      )}
    </li>
  );
}
