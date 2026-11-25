import { useEffect, useState } from "react";

const key = "apt-research-tour-progress-v1";
interface TourProgress { completed: string[]; last?: string }

function load(): TourProgress {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    if (!value || typeof value !== "object") return { completed: [] };
    const { completed, last } = value as Partial<TourProgress>;
    return {
      completed: Array.isArray(completed) ? completed.filter((id) => typeof id === "string") : [],
      last: typeof last === "string" ? last : undefined,
    };
  } catch {
    return { completed: [] };
  }
}

export function useTourProgress(chapter?: string) {
  const [state, setState] = useState(load);
  useEffect(() => {
    if (chapter) setState((previous) => previous.last === chapter ? previous : { ...previous, last: chapter });
  }, [chapter]);
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* The tour works without storage. */ }
  }, [state]);
  return {
    ...state,
    toggleComplete: (id: string) => setState((previous) => ({
      ...previous,
      completed: previous.completed.includes(id) ? previous.completed.filter((item) => item !== id) : [...previous.completed, id],
    })),
  };
}
