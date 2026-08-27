import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginCard } from "@/components/LoginCard";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/charges");
  }

  return <LoginCard />;
}
