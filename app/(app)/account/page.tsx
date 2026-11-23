import { requireUser } from "@/lib/auth";
import { getUserById } from "@/lib/db";
import AccountClient from "./AccountClient";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser("/account");
  const freshUser = getUserById(user.id) ?? user;

  return <AccountClient initialUser={freshUser} />;
}
