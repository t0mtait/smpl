import { NextResponse } from "next/server";
import { getUserByEmail, getUserById, listItems, listWishlist, updateUserProfile } from "@/lib/db";
import { apiUser, hashPassword, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const freshUser = getUserById(user.id);
  if (!freshUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const items = listItems(user.id);
  const wishlist = listWishlist(user.id);

  const ownedCount = items.filter((i) => i.status === "owned").length;
  const purgatoryCount = items.filter((i) => i.status === "purgatory").length;
  const offloadedCount = items.filter((i) =>
    ["sold", "donated", "disposed", "closed"].includes(i.status)
  ).length;

  return NextResponse.json({
    user: freshUser,
    stats: {
      totalItems: items.length,
      ownedCount,
      purgatoryCount,
      offloadedCount,
      wishlistCount: wishlist.length,
    },
  });
}

export async function PATCH(req: Request) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: { name?: string; email?: string; passwordHash?: string; currency?: string } = {};

  if (typeof body.name === "string") {
    patch.name = body.name.trim();
  }

  if (typeof body.currency === "string" && /^[A-Za-z]{3}$/.test(body.currency.trim())) {
    patch.currency = body.currency.trim().toUpperCase();
  }

  const newEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
  if (newEmail && newEmail !== user.email.toLowerCase()) {
    const existing = getUserByEmail(newEmail);
    if (existing && existing.id !== user.id) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
    patch.email = newEmail;
  }

  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (newPassword) {
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters" },
        { status: 400 }
      );
    }
    const fullUser = getUserByEmail(user.email);
    if (!fullUser || !verifyPassword(currentPassword, fullUser.passwordHash)) {
      return NextResponse.json(
        { error: "Current password is required and was incorrect" },
        { status: 400 }
      );
    }
    patch.passwordHash = hashPassword(newPassword);
  }

  const updated = updateUserProfile(user.id, patch);
  return NextResponse.json({ user: updated });
}
