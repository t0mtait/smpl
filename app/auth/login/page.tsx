import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import AuthForm from "../AuthForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Already signed in? Go straight to the app.
  const user = await currentUser();
  if (user) redirect("/");

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-paper px-4 py-12">
      {/* The theme toggle lives outside the form card: a sign-in screen
          that cannot reach the theme switch leaves dark mode unreachable
          until the user is signed in. */}
      <div className="absolute right-4 top-4">
        <ThemeToggle variant="icon" />
      </div>
      <AuthForm mode="login" />
    </div>
  );
}
