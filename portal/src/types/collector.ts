export interface Charge {
  id: string;
  ts: string;
  tool: string;
  seller_ref: string | null;
  agent_ref: string | null;
  resource: string | null;
  rail: string | null;
  status: string;
  http_status: number | null;
  amount_usd: string | null;
  currency: string | null;
  duration_ms: number | null;
  metadata: Record<string, unknown> | null;
}

export interface ChargesResponse {
  items: Charge[];
  next_cursor: string | null;
}

export interface SummaryRow {
  key: string;
  count: number;
  failure_count: number;
  failure_rate: number;
  timed_count: number;
  avg_duration_ms: number | null;
  amount_usd: string;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
}

export interface CreatedKey extends ApiKey {
  key: string;
  account_id: string;
}

export type DateRange = "7d" | "30d";

export interface ChargeFilters {
  range: DateRange;
  agent_ref: string;
  seller_ref: string;
  status: string;
  tool: string;
}
