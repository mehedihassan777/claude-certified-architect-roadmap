import type { Domain } from "./domains";
import type { Week } from "./schema";

/**
 * The small slice of content the browser needs for progress and stats: IDs, days, domains and
 * minutes. Pages pass it down from the server so the full study text is not bundled.
 */
export interface IndexedTask {
  id: string;
  estMinutes: number;
}

export interface IndexedDay {
  day: number;
  week: number;
  title: string;
  domain: Domain;
  estMinutes: number;
  tasks: IndexedTask[];
}

export interface IndexedWeek {
  week: number;
  title: string;
}

export interface ContentIndex {
  weeks: IndexedWeek[];
  days: IndexedDay[];
}

export function buildContentIndex(weeks: readonly Week[]): ContentIndex {
  return {
    weeks: weeks.map(({ week, title }) => ({ week, title })),
    days: weeks.flatMap((week) =>
      week.days.map((day) => ({
        day: day.day,
        week: day.week,
        title: day.title,
        domain: day.domain,
        estMinutes: day.estMinutes,
        tasks: day.tasks.map(({ id, estMinutes }) => ({ id, estMinutes })),
      })),
    ),
  };
}
