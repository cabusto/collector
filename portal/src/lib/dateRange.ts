import { subDays, formatISO } from "date-fns";
import type { DateRange } from "@/types/collector";

export function rangeToParams(range: DateRange): { from: string; to: string } {
  const to = new Date();
  const from = subDays(to, range === "7d" ? 7 : 30);
  return {
    from: formatISO(from),
    to: formatISO(to),
  };
}

export function buildChargeParams(
  filters: Record<string, string>,
  cursor?: string | null
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) params.set(k, v);
  }
  if (cursor) params.set("cursor", cursor);
  params.set("limit", "100");
  return params;
}
