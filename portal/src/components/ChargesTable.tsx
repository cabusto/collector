"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatUsd, formatDate } from "@/lib/utils";
import type { Charge } from "@/types/collector";

const col = createColumnHelper<Charge>();

const STATUS_STYLES: Record<string, string> = {
  recorded: "border-emerald-200 bg-emerald-50 text-emerald-700",
  failed: "border-red-200 bg-red-50 text-red-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
};

const NUMERIC_COLUMNS = new Set(["http_status", "amount_usd", "duration_ms"]);

const columns = [
  col.accessor("ts", {
    header: "Time",
    cell: (i) => <span className="whitespace-nowrap text-[12px] text-muted-foreground">{formatDate(i.getValue())}</span>,
  }),
  col.accessor("tool", { header: "Tool" }),
  col.accessor("agent_ref", {
    header: "Agent",
    cell: (i) => i.getValue() ?? "—",
  }),
  col.accessor("seller_ref", {
    header: "Seller",
    cell: (i) => i.getValue() ?? "—",
  }),
  col.accessor("status", {
    header: "Status",
    cell: (i) => (
      <Badge variant="outline" className={STATUS_STYLES[i.getValue()] ?? "border-border bg-muted text-foreground"}>
        {i.getValue()}
      </Badge>
    ),
  }),
  col.accessor("http_status", {
    header: "HTTP",
    cell: (i) => (
      <span className="font-mono tabular-nums text-[12px]">{i.getValue() ?? "—"}</span>
    ),
  }),
  col.accessor("amount_usd", {
    header: "Amount",
    cell: (i) => <span className="font-mono tabular-nums text-[12px]">{formatUsd(i.getValue())}</span>,
  }),
  col.accessor("duration_ms", {
    header: "ms",
    cell: (i) => (
      <span className="font-mono tabular-nums text-[12px]">
        {i.getValue() != null ? Math.round(i.getValue()!) : "—"}
      </span>
    ),
  }),
  col.accessor("id", {
    header: "ID",
    cell: (i) => <span className="font-mono tabular-nums text-[12px] text-muted-foreground">{i.getValue().slice(-8)}</span>,
    enableSorting: false,
  }),
];

interface ChargesTableProps {
  charges: Charge[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onRowClick: (charge: Charge) => void;
}

export function ChargesTable({
  charges,
  isLoading,
  hasMore,
  onLoadMore,
  onRowClick,
}: ChargesTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "ts", desc: true }]);

  const table = useReactTable({
    data: charges,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (isLoading && charges.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded" />
        ))}
      </div>
    );
  }

  if (!isLoading && charges.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-sm">No charges found for the selected filters.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[880px] text-[13px]">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border/80 bg-muted/70">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className={cn(
                      "sticky top-0 z-10 bg-muted/90 px-3 py-2 text-left text-[12px] font-medium text-muted-foreground backdrop-blur select-none whitespace-nowrap",
                      header.column.getCanSort() && "cursor-pointer",
                      NUMERIC_COLUMNS.has(header.column.id) && "text-right",
                      header.column.id === "id" && "text-right"
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === "asc" && " ↑"}
                    {header.column.getIsSorted() === "desc" && " ↓"}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/40 transition-colors"
                onClick={() => onRowClick(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={cn(
                      "px-3 py-2.5 whitespace-nowrap align-middle",
                      NUMERIC_COLUMNS.has(cell.column.id) && "text-right",
                      cell.column.id === "id" && "text-right"
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={onLoadMore} disabled={isLoading}>
            {isLoading ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
