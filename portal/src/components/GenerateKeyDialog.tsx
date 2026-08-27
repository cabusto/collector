"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { CreatedKey } from "@/types/collector";

interface GenerateKeyDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function GenerateKeyDialog({ open, onClose, onCreated }: GenerateKeyDialogProps) {
  const [name, setName] = useState("");
  const [created, setCreated] = useState<CreatedKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data: CreatedKey = await res.json();
      setCreated(data);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }

  function handleClose() {
    setName("");
    setCreated(null);
    setCopied(false);
    setError(null);
    onClose();
  }

  async function handleCopy() {
    if (!created?.key) return;
    await navigator.clipboard.writeText(created.key);
    setCopied(true);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate API Key</DialogTitle>
        </DialogHeader>

        {!created ? (
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="keyname">Key name</Label>
              <Input
                id="keyname"
                placeholder="e.g. production-agent"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleGenerate} disabled={isLoading || !name.trim()}>
                {isLoading ? "Generating…" : "Generate"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <Alert>
              <AlertDescription className="font-medium text-amber-700 dark:text-amber-400">
                Copy this key now — it will not be shown again.
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Input
                readOnly
                value={created.key}
                className="font-mono text-xs"
                onFocus={(e) => e.target.select()}
              />
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
