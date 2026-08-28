"use client";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatUsd } from "@/lib/utils";
import type { Charge } from "@/types/collector";

const STATUS_COLORS: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
  recorded: "default",
  failed: "destructive",
  pending: "secondary",
};

function DetailBlock({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1 rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="wrap-break-word text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

interface ChargeDrawerProps {
  charge: Charge | null;
  onClose: () => void;
}

export function ChargeDrawer({ charge, onClose }: ChargeDrawerProps) {
  const metadataEntries = Object.entries(charge?.metadata ?? {});
  const isFailure = charge?.status && charge.status !== "recorded";
  const isSlow = (charge?.duration_ms ?? 0) >= 1000;

  return (
    <Drawer open={!!charge} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <div className="flex flex-wrap items-center gap-2">
            {charge?.status ? (
              <Badge variant={STATUS_COLORS[charge.status] ?? "outline"}>{charge.status}</Badge>
            ) : null}
            {isFailure ? <Badge variant="destructive">Needs investigation</Badge> : null}
            {isSlow ? <Badge variant="outline">Slow response</Badge> : null}
          </div>
          <DrawerTitle className="mt-3 text-base font-semibold tracking-tight text-foreground">
            {charge?.seller_ref || charge?.agent_ref || charge?.tool || "Charge detail"}
          </DrawerTitle>
        </DrawerHeader>
        <div className="space-y-6 overflow-y-auto px-4 pb-6">
          <Section title="Overview">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DetailBlock label="Seller" value={charge?.seller_ref ?? "Unassigned"} />
              <DetailBlock label="Agent" value={charge?.agent_ref ?? "Unassigned"} />
              <DetailBlock label="Tool" value={charge?.tool ?? "Unknown"} />
              <DetailBlock label="Timestamp" value={formatDate(charge?.ts)} />
            </div>
          </Section>

          <Section title="Spend and routing">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DetailBlock label="Amount" value={formatUsd(charge?.amount_usd)} />
              <DetailBlock label="Currency" value={charge?.currency ?? "USD"} />
              <DetailBlock label="Resource" value={charge?.resource ?? "Not captured"} />
              <DetailBlock label="Rail" value={charge?.rail ?? "Not captured"} />
            </div>
          </Section>

          <Section title="Performance">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <DetailBlock
                label="Duration"
                value={
                  charge?.duration_ms != null
                    ? `${Math.round(charge.duration_ms).toLocaleString("en-US")} ms`
                    : "Not captured"
                }
              />
              <DetailBlock
                label="HTTP status"
                value={charge?.http_status != null ? String(charge.http_status) : "Not captured"}
              />
              <DetailBlock label="ID" value={charge?.id ?? "Unknown"} />
            </div>
          </Section>

          <Section title="Metadata">
            {metadataEntries.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {metadataEntries.map(([key, value]) => (
                  <DetailBlock
                    key={key}
                    label={key}
                    value={typeof value === "string" ? value : JSON.stringify(value)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-background/70 px-4 py-5 text-sm text-muted-foreground">
                No metadata.
              </div>
            )}
          </Section>

          <details className="rounded-2xl border border-border/70 bg-background/70 px-4 py-4">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">
              Raw payload
            </summary>
            <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-all rounded-2xl bg-muted p-4 text-xs text-foreground">
              {JSON.stringify(charge, null, 2)}
            </pre>
          </details>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
