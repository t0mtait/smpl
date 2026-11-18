import WishlistClient from "./WishlistClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Wishlist · smpl.",
  description: "Intentional purchases and cooldown list.",
};

export default function WishlistPage() {
  return <WishlistClient />;
}
