import { useState } from "react";
import { ACCENTS } from "../api";
import type { Accent, Cadence, Habit, HabitInput, TargetType } from "../api";
import { MONTHS, WEEKDAYS } from "../format";

const CADENCES: { value: Cadence; label: string }[] = [
  { value: "daily", label: "Chaque jour" },
  { value: "weekly", label: "Chaque semaine" },
  { value: "monthly", label: "Chaque mois" },
  { value: "yearly", label: "Chaque année" },
];

interface Props {
  initial?: Habit;
  busy: boolean;
  onSubmit: (input: HabitInput) => void;
  onCancel: () => void;
}

export default function HabitForm({ initial, busy, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [cadence, setCadence] = useState<Cadence>(initial?.cadence ?? "daily");
  const [fixed, setFixed] = useState(initial?.schedule_mode === "fixed");
  const [weekdays, setWeekdays] = useState<number[]>(initial?.weekdays ?? []);
  const [dayOfMonth, setDayOfMonth] = useState(initial?.day_of_month ?? 1);
  const [monthOfYear, setMonthOfYear] = useState(initial?.month_of_year ?? 1);
  const [targetType, setTargetType] = useState<TargetType>(initial?.target_type ?? "binary");
  const [targetValue, setTargetValue] = useState(Number(initial?.target_value ?? 1));
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [color, setColor] = useState<Accent>(initial?.color ?? "bleu");

  const byWeekday = cadence === "daily" || cadence === "weekly";

  function submit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit({
      name: name.trim(),
      note: note.trim() || null,
      cadence,
      schedule_mode: fixed ? "fixed" : "flexible",
      weekdays: fixed && byWeekday ? weekdays : null,
      day_of_month: fixed && !byWeekday ? dayOfMonth : null,
      month_of_year: fixed && cadence === "yearly" ? monthOfYear : null,
      target_type: targetType,
      target_value: targetType === "quantity" ? targetValue : 1,
      unit: targetType === "quantity" ? unit.trim() || null : null,
      color,
    });
  }

  return (
    <form className="panel" onSubmit={submit}>
      <label className="field">
        <span className="field__label">Nom de l'habitude</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={120}
          placeholder="Sortir les poubelles"
        />
      </label>

      <div className="field">
        <span className="field__label">À quel rythme ?</span>
        <div className="chips">
          {CADENCES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className="chip"
              aria-pressed={cadence === value}
              onClick={() => setCadence(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field__label">À une date précise ?</span>
        <div className="chips">
          <button
            type="button"
            className="chip"
            aria-pressed={!fixed}
            onClick={() => setFixed(false)}
          >
            N'importe quand
          </button>
          <button
            type="button"
            className="chip"
            aria-pressed={fixed}
            onClick={() => setFixed(true)}
          >
            {byWeekday ? "Certains jours" : "Une date fixe"}
          </button>
        </div>
        <p className="field__hint">
          {fixed
            ? "L'habitude passe en retard dès que la date est dépassée."
            : cadence === "daily"
              ? "Tous les jours comptent."
              : "À faire quand tu veux dans la période."}
        </p>
      </div>

      {fixed && byWeekday && (
        <div className="field">
          <span className="field__label">Quels jours ?</span>
          <div className="chips">
            {WEEKDAYS.map(({ iso, short, long }) => (
              <button
                key={iso}
                type="button"
                className="chip"
                aria-pressed={weekdays.includes(iso)}
                aria-label={long}
                onClick={() =>
                  setWeekdays((current) =>
                    current.includes(iso)
                      ? current.filter((d) => d !== iso)
                      : [...current, iso].sort((a, b) => a - b),
                  )
                }
              >
                {short}
              </button>
            ))}
          </div>
        </div>
      )}

      {fixed && cadence === "monthly" && (
        <label className="field">
          <span className="field__label">Quel jour du mois ?</span>
          <select value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d === 1 ? "1er" : d}
              </option>
            ))}
          </select>
          <p className="field__hint">
            Dans un mois plus court, la date recule au dernier jour du mois.
          </p>
        </label>
      )}

      {fixed && cadence === "yearly" && (
        <div className="grid-2">
          <label className="field">
            <span className="field__label">Mois</span>
            <select
              value={monthOfYear}
              onChange={(e) => setMonthOfYear(Number(e.target.value))}
            >
              {MONTHS.map((label, index) => (
                <option key={label} value={index + 1}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Jour</span>
            <select value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="field">
        <span className="field__label">Comment la mesurer ?</span>
        <div className="chips">
          <button
            type="button"
            className="chip"
            aria-pressed={targetType === "binary"}
            onClick={() => setTargetType("binary")}
          >
            Fait ou pas fait
          </button>
          <button
            type="button"
            className="chip"
            aria-pressed={targetType === "quantity"}
            onClick={() => setTargetType("quantity")}
          >
            Avec un objectif
          </button>
        </div>
      </div>

      {targetType === "quantity" && (
        <div className="grid-2">
          <label className="field">
            <span className="field__label">Objectif</span>
            <input
              type="number"
              min={0.01}
              step="any"
              value={targetValue}
              onChange={(e) => setTargetValue(Number(e.target.value))}
              required
            />
          </label>
          <label className="field">
            <span className="field__label">Unité</span>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              maxLength={24}
              placeholder="pas, km, verres"
            />
            <p className="field__hint">Laisse vide pour compter en nombre de fois.</p>
          </label>
        </div>
      )}

      <div className="field">
        <span className="field__label">Couleur</span>
        <div className="chips">
          {ACCENTS.map((value) => (
            <button
              key={value}
              type="button"
              className="swatch"
              aria-pressed={color === value}
              aria-label={value}
              onClick={() => setColor(value)}
            >
              <span style={{ background: `var(--${value})` }} />
            </button>
          ))}
        </div>
      </div>

      <label className="field">
        <span className="field__label">Note (facultatif)</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
      </label>

      <div className="btn-row">
        <button type="submit" className="btn" disabled={busy || !name.trim()}>
          {initial ? "Enregistrer" : "Créer l'habitude"}
        </button>
        <button type="button" className="btn btn--quiet" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}
