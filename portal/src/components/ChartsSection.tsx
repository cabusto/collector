"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { formatUsd } from "@/lib/utils";
import { rangeToParams } from "@/lib/dateRange";
import type { ChargeFilters, DateRange, SummaryRow } from "@/types/collector";

const CHART_BAR_COLOR = "var(--color-chart-1)";
const CHART_LINE_COLOR = "var(--color-chart-1)";
const CHART_GRID_COLOR = "rgba(23, 26, 23, 0.08)";
const CHART_CURSOR_COLOR = "rgba(18, 122, 85, 0.08)";
const AXIS_TICK = { fontSize: 11, fill: "var(--color-muted-foreground)" };
const VALUE_TICK = {
  fontSize: 11,
  fill: "var(--color-muted-foreground)",
  fontFamily: "var(--font-geist-mono)",
};
const SELLER_VOLUME_THRESHOLD = 5;

async function fetchSummary(params: URLSearchParams): Promise<SummaryRow[]> {
  const res = await fetch(`/api/summary?${params}`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

function buildParams(groupBy: string, range: DateRange, status?: string) {
  const { from, to } = rangeToParams(range);
  const p = new URLSearchParams({ group_by: groupBy, from, to });
  if (status) p.set("status", status);
  return p;
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDuration(value: number | null | undefined) {
  if (value == null) return "No timing data";
  return `${Math.round(value).toLocaleString("en-US")} ms avg`;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function shortenLabel(value: string | null, max = 20) {
  if (!value) return "Unassigned";
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function sumAmount(rows: SummaryRow[] | undefined) {
  if (!rows) return 0;
  return rows.reduce((total, row) => total + Number(row.amount_usd || 0), 0);
}

function getWorstFailureSeller(rows: SummaryRow[] | undefined) {
  if (!rows) return null;
  const ranked = rows
    .filter((row) => row.key && row.count >= SELLER_VOLUME_THRESHOLD)
    .sort((left, right) => right.failure_rate - left.failure_rate || right.count - left.count);
  return ranked[0] ?? null;
}

function getSlowestSeller(rows: SummaryRow[] | undefined) {
  if (!rows) return null;
  const ranked = rows
    .filter(
      (row) => row.key && row.timed_count >= SELLER_VOLUME_THRESHOLD && row.avg_duration_ms != null
    )
    .sort(
      (left, right) =>
        (right.avg_duration_ms ?? 0) - (left.avg_duration_ms ?? 0) ||
        right.timed_count - left.timed_count
    );
  return ranked[0] ?? null;
}

function getTopRows(rows: SummaryRow[] | undefined, limit = 8) {
  return (rows ?? []).filter((row) => row.key).slice(0, limit);
}

function getSpendShare(row: SummaryRow | null, totalSpend: number) {
  if (!row || totalSpend <= 0) return null;
  return Number(row.amount_usd) / totalSpend;
}

function ChartCard({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,18,0.04)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function SummaryCard({
  title,
  value,
  supporting,
  footnote,
  tone = "default",
}: {
  title: string;
  value: string;
  supporting: string;
  footnote?: string;
  tone?: "default" | "critical";
}) {
  return (
    <section
      className={
        tone === "critical"
          ? "rounded-lg border border-red-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,18,0.04)]"
          : "rounded-lg border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,18,0.04)]"
      }
    >
      <p className="text-[12px] text-muted-foreground">{title}</p>
      <p className="mt-2 font-mono text-[28px] leading-none font-semibold tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-2 text-[13px] font-medium text-foreground">{supporting}</p>
      {footnote ? (
        <p className="mt-1 font-mono text-[12px] tabular-nums text-muted-foreground">{footnote}</p>
      ) : null}
    </section>
  );
}

function ActionCard({
  title,
  value,
  metric,
  actionLabel,
  onAction,
  tone = "default",
}: {
  title: string;
  value: string;
  metric: string;
  actionLabel: string;
  onAction?: () => void;
  tone?: "default" | "critical";
}) {
  return (
    <section
      className={
        tone === "critical"
          ? "rounded-md border border-red-200 bg-red-50/40 p-3"
          : "rounded-md border border-border bg-muted/30 p-3"
      }
    >
      <p className="text-[12px] text-muted-foreground">{title}</p>
      <h3 className="mt-1 text-[16px] font-semibold tracking-tight text-foreground">{value}</h3>
      <p className="mt-2 font-mono text-[12px] tabular-nums text-muted-foreground">{metric}</p>
      <Button
        className="mt-3"
        variant={tone === "critical" ? "destructive" : "default"}
        size="sm"
        onClick={onAction}
        disabled={!onAction}
      >
        {actionLabel}
      </Button>
    </section>
  );
}

function RankedList({
  rows,
  mode,
  onFocusSeller,
}: {
  rows: SummaryRow[];
  mode: "failure" | "latency";
  onFocusSeller?: (patch: Partial<ChargeFilters>) => void;
}) {
  const sortedRows = [...rows]
    .filter((row) =>
      row.key &&
      (mode === "failure" ? row.count >= SELLER_VOLUME_THRESHOLD : row.timed_count >= SELLER_VOLUME_THRESHOLD)
    )
    .sort((left, right) => {
      if (mode === "failure") {
        return right.failure_rate - left.failure_rate || right.count - left.count;
      }
      return (right.avg_duration_ms ?? 0) - (left.avg_duration_ms ?? 0) || right.timed_count - left.timed_count;
    })
    .slice(0, 5);

  if (sortedRows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-3 text-[12px] text-muted-foreground">
        {mode === "failure"
          ? `Minimum ${SELLER_VOLUME_THRESHOLD} calls.`
          : `Minimum ${SELLER_VOLUME_THRESHOLD} timed calls.`}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      {sortedRows.map((row, index) => (
        <div
          key={`${mode}-${row.key}`}
          className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 px-3 py-2.5 last:border-0"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-[12px] font-medium text-muted-foreground">
            {index + 1}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-foreground">{row.key}</p>
            <p className="font-mono text-[12px] tabular-nums text-muted-foreground">
              {mode === "failure"
                ? `${formatCount(row.failure_count)} failures across ${formatCount(row.count)} calls`
                : `${formatCount(row.timed_count)} timed calls`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="font-mono text-[12px] font-semibold tabular-nums text-foreground">
                {mode === "failure" ? formatPercent(row.failure_rate) : formatDuration(row.avg_duration_ms)}
              </p>
              <p className="font-mono text-[12px] tabular-nums text-muted-foreground">{formatUsd(row.amount_usd)}</p>
            </div>
            {row.key ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  onFocusSeller?.({
                    seller_ref: row.key,
                    status: mode === "failure" ? "failed" : "",
                  })
                }
              >
                Inspect
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

interface ChartsSectionProps {
  range: DateRange;
  onApplyFocus: (patch: Partial<ChargeFilters>) => void;
}

export function ChartsSection({ range, onApplyFocus }: ChartsSectionProps) {
  const sellerQ = useQuery({
    queryKey: ["summary", "seller", range],
    queryFn: () => fetchSummary(buildParams("seller_ref", range, "recorded")),
  });

  const sellerHealthQ = useQuery({
    queryKey: ["summary", "seller-health", range],
    queryFn: () => fetchSummary(buildParams("seller_ref", range)),
  });

  const agentQ = useQuery({
    queryKey: ["summary", "agent", range],
    queryFn: () => fetchSummary(buildParams("agent_ref", range, "recorded")),
  });

  const dayQ = useQuery({
    queryKey: ["summary", "day", range],
    queryFn: () => fetchSummary(buildParams("day", range, "recorded")),
  });

  const totalSpend = sumAmount(sellerQ.data);
  const topSeller = sellerQ.data?.[0] ?? null;
  const topAgent = agentQ.data?.[0] ?? null;
  const worstFailureSeller = getWorstFailureSeller(sellerHealthQ.data);
  const slowestSeller = getSlowestSeller(sellerHealthQ.data);
  const topSellers = getTopRows(sellerQ.data);
  const topAgents = getTopRows(agentQ.data);
  const topSellerShare = getSpendShare(topSeller, totalSpend);

  const summaryLoading = sellerQ.isLoading || sellerHealthQ.isLoading || agentQ.isLoading;
  const summaryError = sellerQ.error || sellerHealthQ.error || agentQ.error || dayQ.error;

  return (
    <div className="space-y-4">
      {summaryError && (
        <Alert variant="destructive">
          <AlertDescription>Failed to load dashboard summary.</AlertDescription>
        </Alert>
      )}

      <section className="rounded-lg border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,18,0.04)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">Action center</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          {summaryLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-36 rounded-lg" />
            ))
          ) : (
            <>
              <ActionCard
                title="Top seller"
                value={topSeller?.key ?? "No seller data"}
                metric={
                  topSeller
                    ? `${formatUsd(topSeller.amount_usd)}${
                        topSellerShare != null ? ` • ${formatPercent(topSellerShare)} of spend` : ""
                      }`
                    : "No recorded spend"
                }
                actionLabel="View charges"
                onAction={
                  topSeller?.key ? () => onApplyFocus({ seller_ref: topSeller.key, status: "" }) : undefined
                }
              />
              <ActionCard
                title="Highest failure rate"
                value={worstFailureSeller?.key ?? "No seller data"}
                metric={
                  worstFailureSeller
                    ? `${formatPercent(worstFailureSeller.failure_rate)} failure rate • ${formatCount(
                        worstFailureSeller.failure_count
                      )} failed calls`
                    : `Minimum ${SELLER_VOLUME_THRESHOLD} calls`
                }
                actionLabel="Show failed calls"
                onAction={
                  worstFailureSeller?.key
                    ? () => onApplyFocus({ seller_ref: worstFailureSeller.key, status: "failed" })
                    : undefined
                }
                tone="critical"
              />
              <ActionCard
                title="Slowest seller"
                value={slowestSeller?.key ?? "No seller data"}
                metric={
                  slowestSeller
                    ? `${formatDuration(slowestSeller.avg_duration_ms)} • ${formatCount(
                        slowestSeller.timed_count
                      )} timed calls`
                    : `Minimum ${SELLER_VOLUME_THRESHOLD} timed calls`
                }
                actionLabel="Inspect seller"
                onAction={
                  slowestSeller?.key
                    ? () => onApplyFocus({ seller_ref: slowestSeller.key, status: "" })
                    : undefined
                }
                tone="critical"
              />
            </>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-lg" />
          ))
        ) : (
          <>
            <SummaryCard
              title="Top seller by spend"
              value={topSeller ? formatUsd(topSeller.amount_usd) : "$0.00"}
              supporting={topSeller?.key ?? "No seller data"}
              footnote={
                topSeller && totalSpend > 0
                  ? `${formatPercent(Number(topSeller.amount_usd) / totalSpend)} of recorded spend`
                  : undefined
              }
            />
            <SummaryCard
              title="Top agent by spend"
              value={topAgent ? formatUsd(topAgent.amount_usd) : "$0.00"}
              supporting={topAgent?.key ?? "No agent data"}
              footnote={
                topAgent ? `${formatCount(topAgent.count)} recorded charges` : undefined
              }
            />
            <SummaryCard
              title="Worst seller by failure"
              value={worstFailureSeller ? formatPercent(worstFailureSeller.failure_rate) : "0.0%"}
              supporting={
                worstFailureSeller?.key ?? "No seller data"
              }
              footnote={
                worstFailureSeller
                  ? `${formatCount(worstFailureSeller.failure_count)} failures across ${formatCount(
                      worstFailureSeller.count
                    )} calls`
                  : `Minimum ${SELLER_VOLUME_THRESHOLD} calls`
              }
              tone="critical"
            />
            <SummaryCard
              title="Slowest seller"
              value={slowestSeller ? formatDuration(slowestSeller.avg_duration_ms) : "0 ms avg"}
              supporting={
                slowestSeller?.key ?? "No seller data"
              }
              footnote={
                slowestSeller
                  ? `${formatUsd(slowestSeller.amount_usd)} spend, ${formatCount(
                      slowestSeller.timed_count
                    )} timed calls`
                  : `Minimum ${SELLER_VOLUME_THRESHOLD} timed calls`
              }
              tone="critical"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
        <ChartCard
          title="Top sellers by spend"
          action={
            <Badge variant="default">
              Top 8
            </Badge>
          }
        >
          {sellerQ.isLoading && <Skeleton className="h-64 w-full rounded-lg" />}
          {sellerQ.data && sellerQ.data.length === 0 && (
            <p className="py-20 text-center text-sm text-muted-foreground">No recorded spend.</p>
          )}
          {topSellers.length > 0 && (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={topSellers.map((row) => ({
                  ...row,
                  amount: Number(row.amount_usd),
                  shortKey: shortenLabel(row.key),
                }))}
                layout="vertical"
                margin={{ top: 2, right: 8, left: 0, bottom: 2 }}
              >
                <CartesianGrid horizontal={false} stroke={CHART_GRID_COLOR} />
                <XAxis
                  type="number"
                  tick={VALUE_TICK}
                  tickFormatter={(value) => formatUsd(String(value))}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="shortKey"
                  width={140}
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: CHART_CURSOR_COLOR }}
                  contentStyle={{ borderRadius: 8, borderColor: "var(--color-border)", boxShadow: "0 1px 2px rgba(15,23,18,0.06)" }}
                  formatter={(value) => formatUsd(String(value))}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.key ?? ""}
                />
                <Bar dataKey="amount" fill={CHART_BAR_COLOR} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Seller risk watchlist"
          action={
            <Badge variant="outline">
              Min {SELLER_VOLUME_THRESHOLD} calls
            </Badge>
          }
        >
          <div className="grid gap-4">
            <div className="space-y-2">
              <p className="text-[13px] font-semibold text-foreground">Highest failure rates</p>
              <RankedList rows={sellerHealthQ.data ?? []} mode="failure" onFocusSeller={onApplyFocus} />
            </div>
            <div className="space-y-2">
              <p className="text-[13px] font-semibold text-foreground">Slowest sellers</p>
              <RankedList rows={sellerHealthQ.data ?? []} mode="latency" onFocusSeller={onApplyFocus} />
            </div>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Spend by agent">
          {agentQ.isLoading && <Skeleton className="h-60 w-full rounded-lg" />}
          {agentQ.data && agentQ.data.length === 0 && (
            <p className="py-20 text-center text-sm text-muted-foreground">No agent spend data.</p>
          )}
          {topAgents.length > 0 && (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={topAgents.map((row) => ({
                  ...row,
                  amount: Number(row.amount_usd),
                  shortKey: shortenLabel(row.key),
                }))}
                layout="vertical"
                margin={{ top: 2, right: 8, left: 0, bottom: 2 }}
              >
                <CartesianGrid horizontal={false} stroke={CHART_GRID_COLOR} />
                <XAxis
                  type="number"
                  tick={VALUE_TICK}
                  tickFormatter={(value) => formatUsd(String(value))}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="shortKey"
                  width={140}
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: CHART_CURSOR_COLOR }}
                  contentStyle={{ borderRadius: 8, borderColor: "var(--color-border)", boxShadow: "0 1px 2px rgba(15,23,18,0.06)" }}
                  formatter={(value) => formatUsd(String(value))}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.key ?? ""}
                />
                <Bar dataKey="amount" fill={CHART_BAR_COLOR} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Spend over time">
          {dayQ.isLoading && <Skeleton className="h-60 w-full rounded-lg" />}
          {dayQ.data && dayQ.data.length === 0 && (
            <p className="py-20 text-center text-sm text-muted-foreground">No daily spend data.</p>
          )}
          {dayQ.data && dayQ.data.length > 0 && (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart
                data={dayQ.data.map((row) => ({ ...row, amount: Number(row.amount_usd) }))}
                margin={{ top: 2, right: 8, left: 0, bottom: 2 }}
              >
                <CartesianGrid stroke={CHART_GRID_COLOR} vertical={false} />
                <XAxis
                  dataKey="key"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={VALUE_TICK}
                  tickFormatter={(value) => formatUsd(String(value))}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => formatUsd(String(value))}
                  contentStyle={{ borderRadius: 8, borderColor: "var(--color-border)", boxShadow: "0 1px 2px rgba(15,23,18,0.06)" }}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke={CHART_LINE_COLOR}
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
