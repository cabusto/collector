"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/charges", label: "Charges" },
  { href: "/keys", label: "API Keys" },
];

export function NavBar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  if (!session) return null;

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
            CP
          </div>
          <div>
            <span className="block text-sm font-semibold tracking-tight">Charges Portal</span>
            <span className="block text-xs text-muted-foreground">Spend intelligence</span>
          </div>
        </div>
        <nav className="flex gap-1 rounded-full border border-border/80 bg-card/80 p-1 shadow-sm">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm transition-colors",
                pathname.startsWith(href)
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground sm:inline">{session.user?.email}</span>
          <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
