"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GenerateKeyDialog } from "@/components/GenerateKeyDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import type { ApiKey } from "@/types/collector";

async function fetchKeys(): Promise<ApiKey[]> {
  const res = await fetch("/api/keys");
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function revokeKey(id: string) {
  const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export function KeysView() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const qc = useQueryClient();

  const { data: keys, isLoading, error } = useQuery({
    queryKey: ["keys"],
    queryFn: fetchKeys,
  });

  const revoke = useMutation({
    mutationFn: revokeKey,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["keys"] }),
  });

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">API Keys</h1>
          <p className="text-[13px] text-muted-foreground">
            Keys are used by middleware to ingest charges.
          </p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>Generate key</Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>Failed to load keys: {String(error)}</AlertDescription>
        </Alert>
      )}

      {revoke.error && (
        <Alert variant="destructive">
          <AlertDescription>Failed to revoke: {String(revoke.error)}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : keys && keys.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-4 py-10 text-center text-muted-foreground">
          <p className="text-[13px]">No active keys. Generate one to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="border-b border-border/80 bg-muted/70">
                <th className="sticky top-0 bg-muted/90 px-3 py-2 text-left text-[12px] font-medium text-muted-foreground">Name</th>
                <th className="sticky top-0 bg-muted/90 px-3 py-2 text-left text-[12px] font-medium text-muted-foreground">Prefix</th>
                <th className="sticky top-0 bg-muted/90 px-3 py-2 text-left text-[12px] font-medium text-muted-foreground">Created</th>
                <th className="sticky top-0 bg-muted/90 px-3 py-2 text-left text-[12px] font-medium text-muted-foreground">Last used</th>
                <th className="sticky top-0 bg-muted/90 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {keys?.map((key) => (
                <tr key={key.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                  <td className="px-3 py-2.5 font-medium">{key.name || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className="font-mono tabular-nums text-[12px]">
                      {key.prefix}…
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-muted-foreground">{formatDate(key.created_at)}</td>
                  <td className="px-3 py-2.5 text-[12px] text-muted-foreground">
                    {key.last_used_at ? formatDate(key.last_used_at) : "Never"}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={revoke.isPending}
                      onClick={() => {
                        if (confirm(`Revoke key "${key.name || key.prefix}…"?`)) {
                          revoke.mutate(key.id);
                        }
                      }}
                    >
                      Revoke
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <GenerateKeyDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={() => qc.invalidateQueries({ queryKey: ["keys"] })}
      />
    </div>
  );
}