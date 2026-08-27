"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ChargeFilters, DateRange } from "@/types/collector";

const DATE_OPTIONS: { label: string; value: DateRange }[] = [
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
];

const STATUS_OPTIONS = ["", "recorded", "failed", "pending"];

interface FilterBarProps {
  filters: ChargeFilters;
  onChange: (filters: ChargeFilters) => void;
  onApply: () => void;
  onReset: () => void;
  onRefresh: () => void;
  isDirty: boolean;
}

export function FilterBar({ filters, onChange, onApply, onReset, onRefresh, isDirty }: FilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  function set<K extends keyof ChargeFilters>(key: K, value: ChargeFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  const advancedFilterCount = [filters.tool, filters.agent_ref, filters.seller_ref].filter(Boolean).length;

  return (
    <section className="rounded-3xl border border-border/70 bg-background/60 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Quick filters
            </p>
            <p className="text-sm text-muted-foreground">
              Start with the narrowest useful choices. Open advanced filters only when the dashboard points you to a specific seller, agent, or tool.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex overflow-hidden rounded-full border border-border bg-card shadow-sm">
              {DATE_OPTIONS.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => set("range", value)}
                  className={`px-4 py-2 text-sm transition-colors ${
                    filters.range === value
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium">Status</Label>
              <Select value={filters.status} onValueChange={(v) => set("status", v ?? "")}>
                <SelectTrigger className="h-10 w-40 bg-card">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  {STATUS_OPTIONS.filter(Boolean).map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              size="default"
              onClick={() => setShowAdvanced((current) => !current)}
            >
              {showAdvanced ? "Hide advanced filters" : "Show advanced filters"}
              {advancedFilterCount > 0 ? ` (${advancedFilterCount})` : ""}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Button variant="outline" size="default" onClick={onReset}>
            Reset
          </Button>
          <Button variant="outline" size="default" onClick={onRefresh}>
            Refresh
          </Button>
          <Button size="default" onClick={onApply} disabled={!isDirty}>
            Apply filters
          </Button>
        </div>
      </div>

      {showAdvanced ? (
        <div className="mt-4 border-t border-border/70 pt-4">
          <div className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Advanced filters
            </p>
            <p className="text-sm text-muted-foreground">
              Use these only when you already know the seller, agent, or tool you need to isolate.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {(["tool", "agent_ref", "seller_ref"] as const).map((key) => (
              <div key={key} className="flex flex-col gap-1">
                <Label className="text-xs font-medium capitalize">{key.replace("_", " ")}</Label>
                <Input
                  className="h-10 w-52 bg-card text-sm"
                  placeholder="Any"
                  value={filters[key]}
                  onChange={(e) => set(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
