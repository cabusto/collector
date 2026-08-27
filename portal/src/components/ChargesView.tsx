"use client";

import { useEffect, useState } from "react";
import { FilterBar } from "@/components/FilterBar";
import { ChargesTable } from "@/components/ChargesTable";
import { ChargeDrawer } from "@/components/ChargeDrawer";
import { ChartsSection } from "@/components/ChartsSection";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  const [selected, setSelected] = useState<Charge | null>(null);

  const { charges, isLoading, error, hasMore, loadMore, refresh, initialFetch } =
    useCharges(filters);

  useEffect(() => {
    initialFetch(undefined);
  }, [filters, initialFetch]);

  return (
    <div className="space-y-6">
      <FilterBar filters={filters} onChange={setFilters} onRefresh={refresh} />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>Failed to load charges: {error}</AlertDescription>
        </Alert>
      )}

      <ChartsSection range={filters.range} />

      <ChargesTable
        charges={charges}
        isLoading={isLoading}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onRowClick={setSelected}
      />

      <ChargeDrawer charge={selected} onClose={() => setSelected(null)} />
    </div>
  );
}