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

const STATUS_STYLES: Record<string, string> = {
  recorded: "border-emerald-200 bg-emerald-50 text-emerald-700",
  failed: "border-red-200 bg-red-50 text-red-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
};

function DetailBlock({
  label,
  value,
  numeric = false,
}: {
  label: string;
  value: string;
  numeric?: boolean;
}) {
  return (
    <div className="space-y-1 rounded-md border border-border bg-muted/30 px-3 py-2.5">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className={numeric ? "wrap-break-word font-mono text-[13px] font-medium tabular-nums text-foreground" : "wrap-break-word text-[13px] font-medium text-foreground"}>{value}</p>
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
      <DrawerContent className="max-h-[85vh] border-l border-border bg-card data-[swipe-axis=x]:sm:[--drawer-content-width:34rem]">
        <DrawerHeader className="border-b border-border pb-4 text-left">
          <div className="flex flex-wrap items-center gap-2">
            {charge?.status ? (
              <Badge variant="outline" className={STATUS_STYLES[charge.status] ?? "border-border bg-muted text-foreground"}>{charge.status}</Badge>
            ) : null}
            {isFailure ? <Badge variant="destructive">Issue</Badge> : null}
            {isSlow ? <Badge variant="outline">Slow</Badge> : null}
          </div>
          <DrawerTitle className="mt-3 text-base font-semibold tracking-tight text-foreground">
            {charge?.seller_ref || charge?.agent_ref || charge?.tool || "Charge detail"}
          </DrawerTitle>
        </DrawerHeader>
        <div className="space-y-4 overflow-y-auto px-4 pb-6 pt-4">
          <Section title="Overview">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <DetailBlock label="Seller" value={charge?.seller_ref ?? "Unassigned"} />
              <DetailBlock label="Agent" value={charge?.agent_ref ?? "Unassigned"} />
              <DetailBlock label="Tool" value={charge?.tool ?? "Unknown"} />
              <DetailBlock label="Timestamp" value={formatDate(charge?.ts)} />
            </div>
          </Section>

          <Section title="Spend and routing">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <DetailBlock label="Amount" value={formatUsd(charge?.amount_usd)} numeric />
              <DetailBlock label="Currency" value={charge?.currency ?? "USD"} />
              <DetailBlock label="Resource" value={charge?.resource ?? "Not captured"} />
              <DetailBlock label="Rail" value={charge?.rail ?? "Not captured"} />
            </div>
          </Section>

          <Section title="Performance">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <DetailBlock
                label="Duration"
                value={
                  charge?.duration_ms != null
                    ? `${Math.round(charge.duration_ms).toLocaleString("en-US")} ms`
                    : "Not captured"
                }
                numeric
              />
              <DetailBlock
                label="HTTP status"
                value={charge?.http_status != null ? String(charge.http_status) : "Not captured"}
                numeric
              />
              <DetailBlock label="ID" value={charge?.id ?? "Unknown"} numeric />
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
              <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-3 text-[12px] text-muted-foreground">
                No metadata.
              </div>
            )}
          </Section>

          <details className="rounded-md border border-border bg-muted/30 px-3 py-3">
            <summary className="cursor-pointer text-[13px] font-semibold text-foreground">
              Raw payload
            </summary>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-card p-3 font-mono text-[12px] text-foreground">
              {JSON.stringify(charge, null, 2)}
            </pre>
          </details>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
