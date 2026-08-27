import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ChargesView } from "@/components/ChargesView";

export default async function ChargesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return <ChargesView />;
}
