export type Cadence = "daily" | "weekly" | "monthly" | "yearly";
export type ScheduleMode = "flexible" | "fixed";
export type TargetType = "binary" | "quantity";
export type HabitState = "done" | "due_today" | "open" | "late";

export const ACCENTS = ["bleu", "garance", "ocre", "olive", "prune", "ardoise"] as const;
export type Accent = (typeof ACCENTS)[number];

export interface User {
  id: string;
  email: string;
  display_name: string;
  accent: Accent;
}

export interface Habit {
  id: string;
  owner_id: string;
  name: string;
  note: string | null;
  cadence: Cadence;
  schedule_mode: ScheduleMode;
  weekdays: number[] | null;
  day_of_month: number | null;
  month_of_year: number | null;
  target_type: TargetType;
  target_value: string;
  unit: string | null;
  color: Accent;
  position: number;
  archived: boolean;
}

export interface HabitStatus {
  habit: Habit;
  period_key: string;
  period_start: string;
  period_end: string;
  progress: string;
  today_value: string;
  target: string;
  done: boolean;
  state: HabitState;
  due_on: string | null;
  missed_last_period: boolean;
  days_left: number;
}

export interface YearGrid {
  year: number;
  habits: Habit[];
  entries: Record<string, Record<string, string>>;
  day_counts: Record<string, number>;
}

export interface Circle {
  shared_with: User[];
  shared_by: User[];
}

export interface HabitInput {
  name: string;
  note: string | null;
  cadence: Cadence;
  schedule_mode: ScheduleMode;
  weekdays: number[] | null;
  day_of_month: number | null;
  month_of_year: number | null;
  target_type: TargetType;
  target_value: number;
  unit: string | null;
  color: Accent;
}

const TOKEN_KEY = "habitude.token";

export const token = {
  read: () => localStorage.getItem(TOKEN_KEY),
  write: (value: string) => localStorage.setItem(TOKEN_KEY, value),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const stored = token.read();
  if (stored) headers.set("Authorization", `Bearer ${stored}`);

  const response = await fetch(`/api${path}`, { ...init, headers });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const detail = body?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail) && detail[0]?.msg
          ? String(detail[0].msg).replace(/^Value error, /, "")
          : "La requête a échoué. Réessaie.";
    throw new ApiError(response.status, message);
  }
  return body as T;
}

const send = (path: string, method: string, payload?: unknown) =>
  request<never>(path, {
    method,
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });

export const api = {
  signUp: (payload: {
    email: string;
    password: string;
    display_name: string;
    accent: Accent;
  }) => request<{ access_token: string; user: User }>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  }),

  signIn: (payload: { email: string; password: string }) =>
    request<{ access_token: string; user: User }>("/auth/signin", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  me: () => request<User>("/auth/me"),

  updateMe: (payload: { display_name?: string; accent?: Accent }) =>
    request<User>("/auth/me", { method: "PATCH", body: JSON.stringify(payload) }),

  habits: () => request<Habit[]>("/habits"),

  createHabit: (payload: HabitInput) =>
    request<Habit>("/habits", { method: "POST", body: JSON.stringify(payload) }),

  updateHabit: (id: string, payload: HabitInput & { archived?: boolean }) =>
    request<Habit>(`/habits/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

  deleteHabit: (id: string) => send(`/habits/${id}`, "DELETE"),

  logEntry: (habitId: string, occurredOn: string, value?: number) =>
    request<unknown>(`/habits/${habitId}/entries`, {
      method: "PUT",
      body: JSON.stringify({ occurred_on: occurredOn, value: value ?? null }),
    }),

  clearEntry: (habitId: string, occurredOn: string) =>
    send(`/habits/${habitId}/entries?occurred_on=${occurredOn}`, "DELETE"),

  today: (ownerId: string, today: string) =>
    request<HabitStatus[]>(`/users/${ownerId}/today?today=${today}`),

  grid: (ownerId: string, year: number) =>
    request<YearGrid>(`/users/${ownerId}/grid?year=${year}`),

  circle: () => request<Circle>("/circle"),

  shareWith: (email: string) =>
    request<User>("/circle", { method: "POST", body: JSON.stringify({ email }) }),

  stopSharing: (viewerId: string) => send(`/circle/${viewerId}`, "DELETE"),
};
