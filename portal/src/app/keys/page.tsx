import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { KeysView } from "@/components/KeysView";

export default async function KeysPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return <KeysView />;
}
