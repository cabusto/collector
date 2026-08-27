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
import { AlertTriangle, Bot, Building2, ChevronRight, TimerReset, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatUsd } from "@/lib/utils";
import { rangeToParams } from "@/lib/dateRange";
import type { ChargeFilters, DateRange, SummaryRow } from "@/types/collector";

const CHART_BAR_COLOR = "var(--color-chart-1)";
const CHART_MUTED_BAR = "var(--color-chart-3)";
const CHART_LINE_COLOR = "var(--color-chart-2)";
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
    .filter((row) => row.key && row.timed_count >= SELLER_VOLUME_THRESHOLD && row.avg_duration_ms != null)
    .sort(
      (left, right) =>
        (right.avg_duration_ms ?? 0) - (left.avg_duration_ms ?? 0) || right.timed_count - left.timed_count
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
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border/80 bg-card/95 p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
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
  icon,
}: {
  title: string;
  value: string;
  supporting: string;
  footnote: string;
  tone?: "default" | "critical";
  icon: React.ReactNode;
}) {
  return (
    <section
      className={
        tone === "critical"
          ? "rounded-3xl border border-destructive/20 bg-[color-mix(in_srgb,var(--destructive)_8%,white)] p-5 shadow-sm"
          : "rounded-3xl border border-border/80 bg-card/95 p-5 shadow-sm"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        </div>
        <div
          className={
            tone === "critical"
              ? "flex h-11 w-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"
              : "flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"
          }
        >
          {icon}
        </div>
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">{supporting}</p>
      <p className="mt-1 text-sm text-muted-foreground">{footnote}</p>
    </section>
  );
}

function ActionCard({
  eyebrow,
  title,
  description,
  metric,
  actionLabel,
  onAction,
  tone = "default",
}: {
  eyebrow: string;
  title: string;
  description: string;
  metric: string;
  actionLabel: string;
  onAction?: () => void;
  tone?: "default" | "critical";
}) {
  return (
    <section
      className={
        tone === "critical"
          ? "rounded-3xl border border-destructive/20 bg-[color-mix(in_srgb,var(--destructive)_8%,white)] p-5 shadow-sm"
          : "rounded-3xl border border-border/80 bg-card/95 p-5 shadow-sm"
      }
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {eyebrow}
      </p>
      <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      <p className="mt-4 text-sm font-medium text-foreground">{metric}</p>
      <Button className="mt-5" variant={tone === "critical" ? "destructive" : "default"} onClick={onAction} disabled={!onAction}>
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
    .filter((row) => row.key && (mode === "failure" ? row.count >= SELLER_VOLUME_THRESHOLD : row.timed_count >= SELLER_VOLUME_THRESHOLD))
    .sort((left, right) => {
      if (mode === "failure") {
        return right.failure_rate - left.failure_rate || right.count - left.count;
      }
      return (right.avg_duration_ms ?? 0) - (left.avg_duration_ms ?? 0) || right.timed_count - left.timed_count;
    })
    .slice(0, 5);

  if (sortedRows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-background/70 px-4 py-5 text-sm text-muted-foreground">
        Need at least {SELLER_VOLUME_THRESHOLD} seller events in the selected range to rank {mode === "failure" ? "failure rate" : "response time"}.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedRows.map((row, index) => (
        <div key={`${mode}-${row.key}`} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/60 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
            {index + 1}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground">{row.key}</p>
            <p className="text-xs text-muted-foreground">
              {mode === "failure"
                ? `${formatCount(row.failure_count)} failures across ${formatCount(row.count)} calls`
                : `${formatCount(row.timed_count)} timed calls`}
            </p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-foreground">
              {mode === "failure" ? formatPercent(row.failure_rate) : formatDuration(row.avg_duration_ms)}
            </p>
            <p className="text-xs text-muted-foreground">{formatUsd(row.amount_usd)} spend</p>
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
    <div className="space-y-6">
      {summaryError && (
        <Alert variant="destructive">
          <AlertDescription>Failed to load dashboard summary.</AlertDescription>
        </Alert>
      )}

      <section className="rounded-[1.75rem] border border-border/80 bg-card/95 p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Action center
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              Start with what deserves action now
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              The page now leads with framed choices: biggest spend concentration first, then the sellers most likely to create financial or operational loss.
            </p>
          </div>
          <Badge variant="outline" className="border-border bg-background px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Anchoring + framing + chunking
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {summaryLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-52 rounded-3xl" />
            ))
          ) : (
            <>
              <ActionCard
                eyebrow="Cost concentration"
                title={topSeller?.key ?? "No dominant seller yet"}
                description="Anchor the review on the seller taking the largest share of recorded spend. This is the fastest path to rate negotiation or vendor review."
                metric={
                  topSeller
                    ? `${formatUsd(topSeller.amount_usd)}${topSellerShare != null ? ` • ${formatPercent(topSellerShare)} of spend` : ""}`
                    : "No recorded spend in the selected range"
                }
                actionLabel="Review seller charges"
                onAction={topSeller?.key ? () => onApplyFocus({ seller_ref: topSeller.key, status: "" }) : undefined}
              />
              <ActionCard
                eyebrow="Reliability risk"
                title={worstFailureSeller?.key ?? "Need more seller volume"}
                description="Frame failure as a loss to avoid. Investigate sellers with the highest failure rate before they distort spend and agent outcomes."
                metric={
                  worstFailureSeller
                    ? `${formatPercent(worstFailureSeller.failure_rate)} failure rate • ${formatCount(worstFailureSeller.failure_count)} failed calls`
                    : `At least ${SELLER_VOLUME_THRESHOLD} seller events are needed to rank failure risk`
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
                eyebrow="Performance drag"
                title={slowestSeller?.key ?? "Need more timing data"}
                description="Use latency as the next decision branch once failures are understood. Slow sellers quietly drain agent throughput and manager confidence."
                metric={
                  slowestSeller
                    ? `${formatDuration(slowestSeller.avg_duration_ms)} • ${formatCount(slowestSeller.timed_count)} timed calls`
                    : `At least ${SELLER_VOLUME_THRESHOLD} timed calls are needed to rank latency`
                }
                actionLabel="Inspect slow seller"
                onAction={slowestSeller?.key ? () => onApplyFocus({ seller_ref: slowestSeller.key, status: "" }) : undefined}
                tone="critical"
              />
            </>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-40 rounded-3xl" />
          ))
        ) : (
          <>
            <SummaryCard
              title="Top seller by spend"
              value={topSeller?.key ?? "No seller data"}
              supporting={topSeller ? formatUsd(topSeller.amount_usd) : "No recorded spend"}
              footnote={
                topSeller && totalSpend > 0
                  ? `${formatPercent(Number(topSeller.amount_usd) / totalSpend)} of recorded spend in range`
                  : "Track the largest external cost center"
              }
              icon={<Building2 className="size-5" />}
            />
            <SummaryCard
              title="Top agent by spend"
              value={topAgent?.key ?? "No agent data"}
              supporting={topAgent ? formatUsd(topAgent.amount_usd) : "No recorded spend"}
              footnote={
                topAgent
                  ? `${formatCount(topAgent.count)} recorded charges in range`
                  : "Identify which agent is driving the most spend"
              }
              icon={<Bot className="size-5" />}
            />
            <SummaryCard
              title="Worst seller by failure"
              value={worstFailureSeller?.key ?? "Need more seller volume"}
              supporting={
                worstFailureSeller
                  ? `${formatPercent(worstFailureSeller.failure_rate)} failure rate`
                  : `Volume threshold: ${SELLER_VOLUME_THRESHOLD} calls`
              }
              footnote={
                worstFailureSeller
                  ? `${formatCount(worstFailureSeller.failure_count)} failures across ${formatCount(worstFailureSeller.count)} calls`
                  : "Highlight sellers to investigate or block"
              }
              tone="critical"
              icon={<AlertTriangle className="size-5" />}
            />
            <SummaryCard
              title="Worst seller by response time"
              value={slowestSeller?.key ?? "Need more timing data"}
              supporting={slowestSeller ? formatDuration(slowestSeller.avg_duration_ms) : `Volume threshold: ${SELLER_VOLUME_THRESHOLD} timed calls`}
              footnote={
                slowestSeller
                  ? `${formatUsd(slowestSeller.amount_usd)} spend, ${formatCount(slowestSeller.timed_count)} timed calls`
                  : "Identify the slowest seller to escalate"
              }
              tone="critical"
              icon={<TimerReset className="size-5" />}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
        <ChartCard
          title="Top sellers by spend"
          subtitle="Ranked sellers make cost concentration obvious at a glance."
          action={<Badge variant="outline" className="border-primary/15 bg-primary/10 px-3 py-1 text-primary">Top 8</Badge>}
        >
          {sellerQ.isLoading && <Skeleton className="h-90 w-full rounded-2xl" />}
          {sellerQ.data && sellerQ.data.length === 0 && (
            <p className="py-20 text-center text-sm text-muted-foreground">No recorded spend for the selected range.</p>
          )}
          {topSellers.length > 0 && (
            <ResponsiveContainer width="100%" height={360}>
              <BarChart
                data={topSellers.map((row) => ({
                  ...row,
                  amount: Number(row.amount_usd),
                  shortKey: shortenLabel(row.key),
                }))}
                layout="vertical"
                margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
              >
                <CartesianGrid horizontal={false} stroke="rgba(16,42,34,0.08)" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                  tickFormatter={(value) => formatUsd(String(value))}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="shortKey"
                  width={140}
                  tick={{ fontSize: 12, fill: "var(--color-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(23,107,77,0.06)" }}
                  formatter={(value) => formatUsd(String(value))}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.key ?? ""}
                />
                <Bar dataKey="amount" fill={CHART_BAR_COLOR} radius={[0, 12, 12, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Seller risk watchlist"
          subtitle="The worst sellers by reliability and latency deserve action first."
          action={
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
              Volume threshold <ChevronRight className="size-3" /> {SELLER_VOLUME_THRESHOLD}
            </span>
          }
        >
          <div className="grid gap-5">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Highest failure rates</p>
                <p className="text-xs text-muted-foreground">Use this list to escalate or block unreliable sellers.</p>
              </div>
              <RankedList rows={sellerHealthQ.data ?? []} mode="failure" onFocusSeller={onApplyFocus} />
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Slowest response times</p>
                <p className="text-xs text-muted-foreground">Target sellers slowing agent execution and user-facing workflows.</p>
              </div>
              <RankedList rows={sellerHealthQ.data ?? []} mode="latency" onFocusSeller={onApplyFocus} />
            </div>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard
          title="Top agents by spend"
          subtitle="See which agents are responsible for the most external spend."
        >
          {agentQ.isLoading && <Skeleton className="h-80 w-full rounded-2xl" />}
          {agentQ.data && agentQ.data.length === 0 && (
            <p className="py-20 text-center text-sm text-muted-foreground">No agent spend data for the selected range.</p>
          )}
          {topAgents.length > 0 && (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={topAgents.map((row) => ({
                  ...row,
                  amount: Number(row.amount_usd),
                  shortKey: shortenLabel(row.key),
                }))}
                layout="vertical"
                margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
              >
                <CartesianGrid horizontal={false} stroke="rgba(16,42,34,0.08)" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                  tickFormatter={(value) => formatUsd(String(value))}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="shortKey"
                  width={140}
                  tick={{ fontSize: 12, fill: "var(--color-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(23,107,77,0.06)" }}
                  formatter={(value) => formatUsd(String(value))}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.key ?? ""}
                />
                <Bar dataKey="amount" fill={CHART_MUTED_BAR} radius={[0, 12, 12, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Recorded spend over time"
          subtitle="Use the trendline to see whether spend is accelerating or stabilizing."
          action={<Wallet className="size-4 text-primary" />}
        >
          {dayQ.isLoading && <Skeleton className="h-80 w-full rounded-2xl" />}
          {dayQ.data && dayQ.data.length === 0 && (
            <p className="py-20 text-center text-sm text-muted-foreground">No daily spend data for the selected range.</p>
          )}
          {dayQ.data && dayQ.data.length > 0 && (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart
                data={dayQ.data.map((row) => ({ ...row, amount: Number(row.amount_usd) }))}
                margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
              >
                <CartesianGrid stroke="rgba(16,42,34,0.08)" vertical={false} />
                <XAxis
                  dataKey="key"
                  tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                  tickFormatter={(value) => formatUsd(String(value))}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip formatter={(value) => formatUsd(String(value))} />
                <Line type="monotone" dataKey="amount" stroke={CHART_LINE_COLOR} dot={false} strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
