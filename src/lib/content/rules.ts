export const TOTAL_DAYS = 42;
export const TOTAL_WEEKS = 6;
export const DAYS_PER_WEEK = 7;

/** Week reviews plus the final review; each has exactly 10 self-check questions. */
export const REVIEW_DAYS: readonly number[] = [7, 14, 21, 28, 35, 42];
export const SELF_CHECKS_PER_DAY = { min: 3, max: 5 } as const;
export const SELF_CHECKS_PER_REVIEW_DAY = 10;
export const MIN_MULTI_RESPONSE_PER_REVIEW_DAY = 2;

export const RECALL_MINUTES = 10;

/** Resource titles for community sources must end with this label. */
export const COMMUNITY_LABEL = "(community, not affiliated with Anthropic)";

export function isReviewDay(day: number): boolean {
  return REVIEW_DAYS.includes(day);
}
