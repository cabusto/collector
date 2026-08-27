"use client";

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
  onRefresh: () => void;
}

export function FilterBar({ filters, onChange, onRefresh }: FilterBarProps) {
  function set<K extends keyof ChargeFilters>(key: K, value: ChargeFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="flex flex-wrap gap-3 items-end pb-4 border-b">
      {/* Date range toggle */}
      <div className="flex rounded-md border overflow-hidden">
        {DATE_OPTIONS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => set("range", value)}
            className={`px-3 py-1.5 text-sm transition-colors ${
              filters.range === value
                ? "bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs">Status</Label>
          <Select value={filters.status} onValueChange={(v) => set("status", v ?? "")}>
          <SelectTrigger className="w-36 h-8">
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

      {(["tool", "agent_ref", "seller_ref"] as const).map((key) => (
        <div key={key} className="flex flex-col gap-1">
          <Label className="text-xs capitalize">{key.replace("_", " ")}</Label>
          <Input
            className="h-8 w-36 text-sm"
            placeholder="Any"
            value={filters[key]}
            onChange={(e) => set(key, e.target.value)}
          />
        </div>
      ))}

      <Button variant="outline" size="sm" onClick={onRefresh} className="self-end">
        Refresh
      </Button>
    </div>
  );
}
