"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginCard() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-[0_1px_2px_rgba(15,23,18,0.04)]">
        <CardHeader className="space-y-1">
          <CardTitle className="text-[20px] font-semibold tracking-tight">Charges Portal</CardTitle>
          <CardDescription className="text-[13px]">Sign in to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => signIn("google", { callbackUrl: "/charges" })}>
            Continue with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}