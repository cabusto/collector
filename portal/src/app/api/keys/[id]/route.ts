import { NextRequest, NextResponse } from "next/server";
import { collectorFetch } from "@/lib/collector";
import { auth } from "@/lib/auth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const res = await collectorFetch(`/v1/api-keys/${id}`, { method: "DELETE" }, "admin");
  const data = await res.json();
  if (!res.ok) return NextResponse.json(data, { status: res.status });
  return NextResponse.json(data);
}
