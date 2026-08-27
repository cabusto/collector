"use client";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { Charge } from "@/types/collector";

interface ChargeDrawerProps {
  charge: Charge | null;
  onClose: () => void;
}

export function ChargeDrawer({ charge, onClose }: ChargeDrawerProps) {
  return (
    <Drawer open={!!charge} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[80vh]">
        <DrawerHeader>
          <DrawerTitle className="font-mono text-sm">{charge?.id}</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-6 overflow-y-auto">
          <pre className="text-xs bg-muted rounded p-4 overflow-x-auto whitespace-pre-wrap break-all">
            {JSON.stringify(charge, null, 2)}
          </pre>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
