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
      <section className="rounded-[1.75rem] border border-border/80 bg-card/95 p-6 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Spend and seller performance
        </h1>
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
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Recent charges</h2>
          {activeFilters.length > 0 ? (
            <Button variant="outline" onClick={resetFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>

        {activeFilters.length > 0 ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {activeFilters.map((item) => (
              <Badge
                key={item.label}
                variant="outline"
                className="border-border bg-background px-3 py-1 text-sm text-foreground"
              >
                {item.label}
              </Badge>
            ))}
          </div>
        ) : null}

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