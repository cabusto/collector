"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { BarChart3, KeyRound, RefreshCw } from "lucide-react";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/charges", label: "Charges", icon: BarChart3 },
  { href: "/keys", label: "API Keys", icon: KeyRound },
];

function getPageLabel(pathname: string) {
  if (pathname.startsWith("/keys")) return "API Keys";
  if (pathname.startsWith("/login")) return "Login";
  return "Charges";
}

export function NavBar({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  if (!session) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="border-b border-border bg-card lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-4 px-4 py-4 lg:block lg:space-y-8 lg:px-5 lg:py-5">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold tracking-tight text-foreground">Charges Portal</p>
            <p className="text-[12px] text-muted-foreground">Spend intelligence</p>
          </div>
          <nav className="flex min-w-0 gap-1 overflow-x-auto lg:grid lg:gap-1">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
                  pathname.startsWith(href)
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div>
            <p className="text-[15px] font-semibold text-foreground">{getPageLabel(pathname)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
            <span className="hidden text-[12px] text-muted-foreground md:inline">{session.user?.email}</span>
            <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
              Sign out
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] px-4 py-4 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
