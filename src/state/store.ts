// Workspace state: the user's role, settings and everything they create (estimates, notes, pins, imports).
// Persisted to localStorage per browser. Exportable as JSON from Settings.
import { useSyncExternalStore } from "react";

export type Role = "budget" | "council";

export interface SavedEstimate {
  id: string;
  createdAt: string;
  name: string;
  assetClass: string;
  agency: string | null;
  boro: string | null;
  baseEstimate: number;
  p50: number;
  p80: number;
  p90: number;
  expectedSlipDays: number | null;
  comparables: number;
  notes?: string;
}

export interface CustomBudgetLine {
  id: string;
  name: string;
  agency: string;
  adopted: number;
  /** Spending by month of the fiscal year so far, July = index 0. */
  monthly: number[];
  /** Share of annual spending that typically lands in each month (12 values summing to 1). Optional. */
  profile?: number[];
}

export interface FiscalNoteDraft {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  billNumber: string;
  agency: string;
  inputs: Record<string, number | string | boolean>;
}

export interface ImportedProject {
  id: string;
  name: string;
  assetClass: string;
  agency: string;
  boro: string;
  originalBudget: number;
  currentBudget: number;
  originalEnd: string | null;
  currentEnd: string | null;
}

export interface ScenarioDraft {
  id: string;
  name: string;
  createdAt: string;
  adjustments: Record<string, number>;
}

export interface Workspace {
  version: 1;
  role: Role;
  onboarded: boolean;
  theme: "light" | "dark" | "system";
  city: string;
  council: { district: number | null };
  ai: { apiKey: string; model: string; effort: "low" | "medium" | "high" };
  estimates: SavedEstimate[];
  pinnedProjects: string[];
  projectNotes: Record<string, string>;
  customLines: CustomBudgetLine[];
  fiscalNotes: FiscalNoteDraft[];
  importedProjects: ImportedProject[];
  scenarios: ScenarioDraft[];
  recent: { path: string; title: string; at: string }[];
}

export const DEFAULT_MODEL = "claude-opus-5-5";

const DEFAULT: Workspace = {
  version: 1,
  role: "budget",
  onboarded: false,
  theme: "system",
  city: "New York City",
  council: { district: null },
  ai: { apiKey: "", model: DEFAULT_MODEL, effort: "medium" },
  estimates: [],
  pinnedProjects: [],
  projectNotes: {},
  customLines: [],
  fiscalNotes: [],
  importedProjects: [],
  scenarios: [],
  recent: [],
};

const KEY = "baseline:workspace";
const listeners = new Set<() => void>();

function read(): Workspace {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<Workspace>;
    return { ...DEFAULT, ...parsed, ai: { ...DEFAULT.ai, ...(parsed.ai ?? {}) }, council: { ...DEFAULT.council, ...(parsed.council ?? {}) } };
  } catch {
    return DEFAULT;
  }
}

let state: Workspace = typeof window === "undefined" ? DEFAULT : read();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage can be full or blocked (private mode). The app keeps working in memory.
  }
}

export function getWorkspace(): Workspace {
  return state;
}

export function updateWorkspace(fn: (draft: Workspace) => Workspace | void): void {
  const copy = structuredClone(state);
  const next = fn(copy) ?? copy;
  state = next;
  persist();
  listeners.forEach((l) => l());
}

export function replaceWorkspace(next: Partial<Workspace>): void {
  state = { ...DEFAULT, ...next, version: 1 };
  persist();
  listeners.forEach((l) => l());
}

export function resetWorkspace(): void {
  state = { ...DEFAULT, onboarded: true, role: state.role, theme: state.theme };
  persist();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      state = read();
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Subscribe to a slice of the workspace. The selector must return a stable value (primitive or a reference held in state). */
export function useWorkspace<T>(selector: (w: Workspace) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(DEFAULT),
  );
}

export const useRole = () => useWorkspace((w) => w.role);

export function setRole(role: Role) {
  updateWorkspace((w) => {
    w.role = role;
    w.onboarded = true;
  });
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function applyTheme(theme: Workspace["theme"]) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  try {
    if (theme === "system") localStorage.removeItem("baseline:theme");
    else localStorage.setItem("baseline:theme", theme);
  } catch {
    /* ignore */
  }
}
