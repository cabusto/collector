import { NextRequest, NextResponse } from "next/server";
import { collectorFetch } from "@/lib/collector";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const qs = searchParams.toString();
  const res = await collectorFetch(`/v1/charges/summary${qs ? `?${qs}` : ""}`);
  const data = await res.json();
  if (!res.ok) return NextResponse.json(data, { status: res.status });
  return NextResponse.json(data);
}
