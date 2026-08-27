"use client";

import { useEffect, useState } from "react";
import { FilterBar } from "@/components/FilterBar";
import { ChargesTable } from "@/components/ChargesTable";
import { ChargeDrawer } from "@/components/ChargeDrawer";
import { ChartsSection } from "@/components/ChartsSection";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCharges } from "@/hooks/useCharges";
import type { Charge, ChargeFilters } from "@/types/collector";

const DEFAULT_FILTERS: ChargeFilters = {
  range: "7d",
  agent_ref: "",
  seller_ref: "",
  status: "",
  tool: "",
};

export function ChargesView() {
  const [filters, setFilters] = useState<ChargeFilters>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<ChargeFilters>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<Charge | null>(null);

  const { charges, isLoading, error, hasMore, loadMore, refresh, initialFetch } =
    useCharges(filters);

  const filtersDirty = JSON.stringify(filters) !== JSON.stringify(draftFilters);
  const activeFilters = [
    filters.status ? { label: `Status: ${filters.status}` } : null,
    filters.tool ? { label: `Tool: ${filters.tool}` } : null,
    filters.agent_ref ? { label: `Agent: ${filters.agent_ref}` } : null,
    filters.seller_ref ? { label: `Seller: ${filters.seller_ref}` } : null,
  ].filter(Boolean) as { label: string }[];

  useEffect(() => {
    initialFetch(undefined);
  }, [filters, initialFetch]);

  function applyFilters() {
    setFilters(draftFilters);
  }

  function resetFilters() {
    setDraftFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
  }

  function applyFocus(patch: Partial<ChargeFilters>) {
    const nextFilters = { ...DEFAULT_FILTERS, ...filters, ...patch };
    setDraftFilters(nextFilters);
    setFilters(nextFilters);
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 rounded-[1.75rem] border border-border/80 bg-card/95 p-6 shadow-sm lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/20 bg-primary/10 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-primary">
              Enterprise spend monitoring
            </Badge>
            <Badge variant="outline" className="border-border bg-background px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Finance + engineering
            </Badge>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Spend and seller performance
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
              Surface top expenses, isolate weak sellers, and understand which agents are driving spend before you take action.
            </p>
          </div>
        </div>
        <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em]">Priority</p>
            <p className="mt-1 text-sm font-medium text-foreground">Top spend and seller health</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em]">Outcome</p>
            <p className="mt-1 text-sm font-medium text-foreground">Block, negotiate, or investigate</p>
          </div>
        </div>
      </section>

      <FilterBar
        filters={draftFilters}
        onChange={setDraftFilters}
        onApply={applyFilters}
        onReset={resetFilters}
        onRefresh={refresh}
        isDirty={filtersDirty}
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>Failed to load charges: {error}</AlertDescription>
        </Alert>
      )}

      <ChartsSection range={filters.range} onApplyFocus={applyFocus} />

      <section className="rounded-[1.75rem] border border-border/80 bg-card/95 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-primary/15 bg-primary/10 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-primary">
                Investigation workspace
              </Badge>
              {activeFilters.length > 0 ? (
                <Badge variant="outline" className="border-border bg-background px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {activeFilters.length} active filter{activeFilters.length === 1 ? "" : "s"}
                </Badge>
              ) : null}
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Investigate the evidence
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Start with the recommended actions above, then narrow the underlying charges here when you need proof, vendor detail, or agent-level context.
              </p>
            </div>
          </div>

          {activeFilters.length > 0 ? (
            <Button variant="outline" onClick={resetFilters}>
              Clear investigation
            </Button>
          ) : null}
        </div>

        {activeFilters.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {activeFilters.map((item) => (
              <Badge key={item.label} variant="outline" className="border-border bg-background px-3 py-1 text-sm text-foreground">
                {item.label}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="mt-5">
          <FilterBar
            filters={draftFilters}
            onChange={setDraftFilters}
            onApply={applyFilters}
            onReset={resetFilters}
            onRefresh={refresh}
            isDirty={filtersDirty}
          />
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-border/80 bg-card/95 p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Charge-level evidence</h2>
            <p className="text-sm text-muted-foreground">
              Review raw charge events after the dashboard has helped you decide where to look.
            </p>
          </div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Newest activity and matched filters
          </p>
        </div>

        <ChargesTable
          charges={charges}
          isLoading={isLoading}
          hasMore={hasMore}
          onLoadMore={loadMore}
          onRowClick={setSelected}
        />
      </section>

      <ChargeDrawer charge={selected} onClose={() => setSelected(null)} />
    </div>
  );
}