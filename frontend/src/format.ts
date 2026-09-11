import type { Habit, HabitStatus } from "./api";

export const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export const MONTHS_SHORT = [
  "jan", "fév", "mar", "avr", "mai", "juin",
  "juil", "août", "sep", "oct", "nov", "déc",
];

/** ISO weekday order: Monday first, the way a French calendar is printed. */
export const WEEKDAYS = [
  { iso: 1, short: "lun", long: "lundi" },
  { iso: 2, short: "mar", long: "mardi" },
  { iso: 3, short: "mer", long: "mercredi" },
  { iso: 4, short: "jeu", long: "jeudi" },
  { iso: 5, short: "ven", long: "vendredi" },
  { iso: 6, short: "sam", long: "samedi" },
  { iso: 7, short: "dim", long: "dimanche" },
];

/** Today in the browser's own timezone, never shifted through UTC. */
export function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function todayISO(): string {
  return isoDate(new Date());
}

export function parseISO(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function longDate(value: string): string {
  const date = parseISO(value);
  const weekday = WEEKDAYS[(date.getDay() + 6) % 7].long;
  return `${weekday} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function dayOrdinal(day: number): string {
  return day === 1 ? "1er" : String(day);
}

function amount(habit: Habit): string {
  const value = Number(habit.target_value);
  if (habit.target_type !== "quantity") return "";
  return habit.unit ? `${value} ${habit.unit}` : `${value} fois`;
}

/** A one-line reading of when this habit is expected. */
export function cadenceLabel(habit: Habit): string {
  const quantity = amount(habit);
  const days = (habit.weekdays ?? [])
    .map((iso) => WEEKDAYS.find((d) => d.iso === iso)?.long ?? "")
    .filter(Boolean);

  if (habit.schedule_mode === "fixed") {
    if (habit.cadence === "daily" || habit.cadence === "weekly") {
      const list =
        days.length === 1
          ? `chaque ${days[0]}`
          : `le ${days.slice(0, -1).join(", ")} et le ${days[days.length - 1]}`;
      return quantity ? `${quantity}, ${list}` : list;
    }
    if (habit.cadence === "monthly") {
      const list = `le ${dayOrdinal(habit.day_of_month ?? 1)} du mois`;
      return quantity ? `${quantity}, ${list}` : list;
    }
    const list = `le ${habit.day_of_month} ${MONTHS[(habit.month_of_year ?? 1) - 1]}`;
    return quantity ? `${quantity}, ${list}` : list;
  }

  const per = {
    daily: "par jour",
    weekly: "par semaine",
    monthly: "par mois",
    yearly: "par an",
  }[habit.cadence];

  if (quantity) return `${quantity} ${per}`;
  return habit.cadence === "daily" ? "chaque jour" : `une fois ${per}`;
}

export const PERIOD_NOUN: Record<Habit["cadence"], string> = {
  daily: "aujourd'hui",
  weekly: "cette semaine",
  monthly: "ce mois-ci",
  yearly: "cette année",
};

/** The small grey line under a habit name: what remains, or what slipped. */
export function statusNote(status: HabitStatus): string {
  const { habit, days_left, due_on, state } = status;

  if (state === "done") return `Fait ${PERIOD_NOUN[habit.cadence]}`;
  if (state === "late" && due_on === null) return "En retard";
  if (due_on) {
    const today = todayISO();
    if (due_on === today) return "Prévu aujourd'hui";
    return `Prévu ${longDate(due_on)}`;
  }
  if (habit.cadence === "daily") return "";
  if (days_left === 0) return "Dernier jour";
  return days_left === 1 ? "Encore 1 jour" : `Encore ${days_left} jours`;
}

export function progressLabel(status: HabitStatus): string {
  const done = Number(status.progress);
  const target = Number(status.target);
  const unit = status.habit.unit ? ` ${status.habit.unit}` : "";
  return `${done}/${target}${unit}`;
}

export function accentVar(accent: string): string {
  return `var(--${accent})`;
}
