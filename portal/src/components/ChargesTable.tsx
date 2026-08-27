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
import { formatUsd, formatDate } from "@/lib/utils";
import type { Charge } from "@/types/collector";

const col = createColumnHelper<Charge>();

const STATUS_COLORS: Record<string, string> = {
  recorded: "default",
  failed: "destructive",
  pending: "secondary",
};

const columns = [
  col.accessor("ts", {
    header: "Time",
    cell: (i) => <span className="text-xs whitespace-nowrap">{formatDate(i.getValue())}</span>,
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
      <Badge variant={(STATUS_COLORS[i.getValue()] ?? "outline") as "default" | "destructive" | "secondary" | "outline"}>
        {i.getValue()}
      </Badge>
    ),
  }),
  col.accessor("http_status", {
    header: "HTTP",
    cell: (i) => i.getValue() ?? "—",
  }),
  col.accessor("amount_usd", {
    header: "Amount",
    cell: (i) => <span className="font-mono text-xs">{formatUsd(i.getValue())}</span>,
  }),
  col.accessor("duration_ms", {
    header: "ms",
    cell: (i) => (i.getValue() != null ? Math.round(i.getValue()!) : "—"),
  }),
  col.accessor("id", {
    header: "ID",
    cell: (i) => <span className="font-mono text-xs text-muted-foreground">{i.getValue().slice(-8)}</span>,
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
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b bg-muted/50">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2 text-left font-medium text-muted-foreground cursor-pointer select-none whitespace-nowrap"
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
                className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => onRowClick(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 whitespace-nowrap">
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
