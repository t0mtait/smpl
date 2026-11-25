import { requireUser } from "@/lib/auth";
import { listWishlist } from "@/lib/db";
import WishlistClient from "./WishlistClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Wishlist · smpl.",
  description: "Intentional purchases and cooldown list.",
};

export default async function WishlistPage() {
  const user = await requireUser("/wishlist");
  const savedCount = listWishlist(user.id).length;
  return <WishlistClient isPro={user.plan === "premium"} initialSavedCount={savedCount} />;
}
