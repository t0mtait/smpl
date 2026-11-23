import { requireUser } from "@/lib/auth";
import WishlistClient from "./WishlistClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Wishlist · smpl.",
  description: "Intentional purchases and cooldown list.",
};

export default async function WishlistPage() {
  const user = await requireUser("/wishlist");
  return <WishlistClient isPro={user.plan === "premium"} />;
}
