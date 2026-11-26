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
  const wishlistItems = listWishlist(user.id);
  const savedCount = wishlistItems.length;
  const initialSumCost = wishlistItems.reduce((acc, i) => acc + (i.price ?? 0), 0);
  return (
    <WishlistClient
      isPro={user.plan === "premium"}
      initialSavedCount={savedCount}
      initialSumCost={initialSumCost}
    />
  );
}
