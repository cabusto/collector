"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatUsd } from "@/lib/utils";
import { rangeToParams } from "@/lib/dateRange";
import type { DateRange, SummaryRow } from "@/types/collector";

const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

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

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

interface ChartsSectionProps {
  range: DateRange;
}

export function ChartsSection({ range }: ChartsSectionProps) {
  const sellerQ = useQuery({
    queryKey: ["summary", "seller", range],
    queryFn: () => fetchSummary(buildParams("seller_ref", range, "recorded")),
  });

  const statusQ = useQuery({
    queryKey: ["summary", "status", range],
    queryFn: () => fetchSummary(buildParams("status", range)),
  });

  const dayQ = useQuery({
    queryKey: ["summary", "day", range],
    queryFn: () => fetchSummary(buildParams("day", range, "recorded")),
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Spend by seller */}
      <ChartCard title="Spend by seller">
        {sellerQ.isLoading && <Skeleton className="h-40 w-full" />}
        {sellerQ.error && (
          <Alert variant="destructive">
            <AlertDescription>Failed to load</AlertDescription>
          </Alert>
        )}
        {sellerQ.data && sellerQ.data.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-10">No data</p>
        )}
        {sellerQ.data && sellerQ.data.length > 0 && (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={sellerQ.data} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
              <XAxis dataKey="key" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v) => formatUsd(String(v))} />
              <Bar dataKey="amount_usd" fill="#6366f1" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Calls by status */}
      <ChartCard title="Calls by status">
        {statusQ.isLoading && <Skeleton className="h-40 w-full" />}
        {statusQ.error && (
          <Alert variant="destructive">
            <AlertDescription>Failed to load</AlertDescription>
          </Alert>
        )}
        {statusQ.data && statusQ.data.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-10">No data</p>
        )}
        {statusQ.data && statusQ.data.length > 0 && (
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={statusQ.data}
                dataKey="count"
                nameKey="key"
                cx="50%"
                cy="50%"
                outerRadius={60}
                              label={({ key, percent }) =>
                  `${String(key)} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {statusQ.data.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Spend over time */}
      <ChartCard title="Spend over time">
        {dayQ.isLoading && <Skeleton className="h-40 w-full" />}
        {dayQ.error && (
          <Alert variant="destructive">
            <AlertDescription>Failed to load</AlertDescription>
          </Alert>
        )}
        {dayQ.data && dayQ.data.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-10">No data</p>
        )}
        {dayQ.data && dayQ.data.length > 0 && (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={dayQ.data} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
              <XAxis dataKey="key" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v) => formatUsd(String(v))} />
              <Legend />
              <Line
                type="monotone"
                dataKey="amount_usd"
                stroke="#6366f1"
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
