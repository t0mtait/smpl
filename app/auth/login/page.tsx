import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import AuthForm from "../AuthForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Already signed in? Go straight to the app.
  const user = await currentUser();
  if (user) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4 py-12">
      <AuthForm mode="login" />
    </div>
  );
}
