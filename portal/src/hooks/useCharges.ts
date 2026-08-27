"use client";

import { useCallback, useRef, useState } from "react";
import type { Charge, ChargeFilters, ChargesResponse } from "@/types/collector";
import { rangeToParams, buildChargeParams } from "@/lib/dateRange";

export function useCharges(filters: ChargeFilters) {
  const [pages, setPages] = useState<Charge[][]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // track which filter set the current pages belong to
  const filterKey = useRef<string>("");

  const currentKey = JSON.stringify(filters);

  const fetchPage = useCallback(
    async (cursor?: string | null) => {
      setIsLoading(true);
      setError(null);
      const { from, to } = rangeToParams(filters.range);
      const params = buildChargeParams(
        {
          from,
          to,
          ...(filters.status && { status: filters.status }),
          ...(filters.tool && { tool: filters.tool }),
          ...(filters.agent_ref && { agent_ref: filters.agent_ref }),
          ...(filters.seller_ref && { seller_ref: filters.seller_ref }),
        },
        cursor
      );
      try {
        const res = await fetch(`/api/charges?${params}`);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const data: ChargesResponse = await res.json();
        if (!cursor || filterKey.current !== currentKey) {
          // new filter set — reset pages
          filterKey.current = currentKey;
          setPages([data.items]);
        } else {
          setPages((prev) => [...prev, data.items]);
        }
        setNextCursor(data.next_cursor);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentKey]
  );

  return {
    charges: pages.flat(),
    isLoading,
    error,
    hasMore: !!nextCursor,
    loadMore: () => fetchPage(nextCursor),
    refresh: () => {
      filterKey.current = "";
      fetchPage(undefined);
    },
    initialFetch: fetchPage,
  };
}
