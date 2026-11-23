import { requireUser } from "@/lib/auth";
import { getUserById, listItems, listWishlist } from "@/lib/db";
import { getBackupStatus } from "@/lib/backup";
import AccountClient from "./AccountClient";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser("/account");
  const freshUser = getUserById(user.id) ?? user;

  const items = listItems(user.id);
  const wishlist = listWishlist(user.id);

  const ownedCount = items.filter((i) => i.status === "owned").length;
  const purgatoryCount = items.filter((i) => i.status === "purgatory").length;
  const offloadedCount = items.filter((i) =>
    ["sold", "donated", "disposed", "closed"].includes(i.status)
  ).length;

  const backupStatus = getBackupStatus();

  return (
    <AccountClient
      initialUser={freshUser}
      stats={{
        totalItems: items.length,
        ownedCount,
        purgatoryCount,
        offloadedCount,
        wishlistCount: wishlist.length,
      }}
      initialBackup={backupStatus}
    />
  );
}
