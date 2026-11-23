/**
 * Account + ownership tests.
 *
 * These run against a throwaway SQLite database in a temp directory, so
 * they never touch the real data/ folder. They cover the parts of the
 * account system that are easy to break silently:
 *
 *   - password hashing (never stores plaintext, verifies correctly)
 *   - session tokens (only hashes are persisted)
 *   - ownership isolation (one account can never see another's rows)
 *   - bootstrap claiming (the first registration inherits legacy data)
 *
 * Run with: npm test
 */
import { DatabaseSync } from "node:sqlite";
import { hashPassword, verifyPassword } from "../lib/password.ts";
import * as db from "../lib/db.ts";

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean, detail: unknown = ""): void {
  if (cond) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    failed++;
    console.log(`  FAIL ${label}${detail !== "" ? ` — ${String(detail)}` : ""}`);
  }
}

const d = db.getDb();

/* ------------------------------------------------------- password hashing */

{
  const stored = hashPassword("correct horse battery staple");
  check("hash is not the plaintext", stored !== "correct horse battery staple");
  check("hash carries the scrypt scheme", stored.startsWith("scrypt$16384$8$1$"), stored.slice(0, 30));
  check("verify accepts the right password", verifyPassword("correct horse battery staple", stored));
  check("verify rejects the wrong password", !verifyPassword("wrong password", stored));
  check("verify rejects a malformed hash", !verifyPassword("anything", "not-a-hash"));
  check("verify rejects a hash with a bad scheme", !verifyPassword("x", "bcrypt$1$2$3$4$5$6"));
  const second = hashPassword("correct horse battery staple");
  check("two hashes of one password differ (salted)", second !== stored);
}

/* ---------------------------------------------------------- user + session */

{
  const user = db.createUser("alice@example.com", "Alice", hashPassword("alicepassword"));
  check("user row is created", db.getUserByEmail("alice@example.com") !== null);
  check("lookup is case-insensitive", db.getUserByEmail("ALICE@example.com") !== null);
  check("unknown email returns null", db.getUserByEmail("nobody@example.com") === null);

  const token = "raw-token-value-should-never-be-stored";
  db.createSession(user.id, "hashed-token-abc", new Date(Date.now() + 86400000).toISOString());
  check("session resolves for a stored hash", db.findSessionUser("hashed-token-abc")?.id === user.id);
  check("session rejects an unknown hash", db.findSessionUser(token) === null);

  // Expired sessions must not resolve.
  db.createSession(user.id, "expired-hash", new Date(Date.now() - 1000).toISOString());
  check("expired session does not resolve", db.findSessionUser("expired-hash") === null);

  // The raw token must never appear in the database.
  const raw = d
    .prepare("SELECT COUNT(*) c FROM sessions WHERE token_hash = ?")
    .get(token) as { c: number };
  check("raw token is not stored", raw.c === 0);
}

/* ------------------------------------------------------------- ownership */

{
  const alice = db.getUserByEmail("alice@example.com")!;
  const bob = db.createUser("bob@example.com", "Bob", hashPassword("bobpassword"));

  const aItem = db.createItem(alice.id, {
    name: "Alice's kettle",
    category: "kitchen",
    description: "",
    location: "cupboard",
    purchaseDate: "2024-01-01",
    purchasePrice: 100,
    currentValue: 60,
    status: "owned",
    lastUsedAt: null,
    useFrequency: "weekly",
    photoPath: null,
    priority: "auto",
  });
  db.createItem(bob.id, {
    name: "Bob's kettle",
    category: "kitchen",
    description: "",
    location: "shelf",
    purchaseDate: "2024-02-01",
    purchasePrice: 80,
    currentValue: 40,
    status: "owned",
    lastUsedAt: null,
    useFrequency: "weekly",
    photoPath: null,
    priority: "auto",
  });

  check("owner sees only their items", db.listItems(alice.id).length === 1);
  check("owner sees their own item name", db.listItems(alice.id)[0].name === "Alice's kettle");
  check("other account sees only their items", db.listItems(bob.id).length === 1);
  check("cross-account getItem is denied", db.getItem(bob.id, aItem.id) === null);
  check("cross-account getItem by photo path is denied", db.getItemByPhotoPath(bob.id, "photo.png") === null);

  const updated = db.updateItem(bob.id, aItem.id, { name: "hijacked" });
  check("cross-account update is denied", updated === null);
  check("the item was not actually changed", db.getItem(alice.id, aItem.id)?.name === "Alice's kettle");

  check("cross-account delete is denied", db.deleteItem(bob.id, aItem.id) === false);
  check("the item survived the cross-account delete", db.getItem(alice.id, aItem.id) !== null);

  // Wishlist items are account-scoped.
  const aWish = db.createWishlistItem(alice.id, {
    name: "Alice's dream teapot",
    category: "kitchen",
    price: 45,
    notes: "Wait 30 days",
    priority: "high",
  });
  const bWish = db.createWishlistItem(bob.id, {
    name: "Bob's espresso machine",
    category: "kitchen",
    price: 500,
    priority: "medium",
  });

  check("wishlist items are scoped to owner", db.listWishlist(alice.id).length === 1);
  check("owner sees their wishlist item", db.listWishlist(alice.id)[0].name === "Alice's dream teapot");
  check("legacy high priority converts to numeric 80", aWish.priority === 80);
  check("legacy medium priority converts to numeric 50", bWish.priority === 50);
  const updatedBWish = db.updateWishlistItem(bob.id, bWish.id, { priority: 95 });
  check("wishlist priority updates to number out of 100", updatedBWish?.priority === 95);
  check("cross-account getWishlistItem denied", db.getWishlistItem(bob.id, aWish.id) === null);
  check(
    "cross-account updateWishlistItem denied",
    db.updateWishlistItem(bob.id, aWish.id, { name: "hijacked" }) === null
  );
  check("cross-account deleteWishlistItem denied", db.deleteWishlistItem(bob.id, aWish.id) === false);

  // Converting wishlist item to inventory creates owned item and removes wishlist item.
  const converted = db.convertWishlistItemToInventory(alice.id, aWish.id, 40);
  check("converted item returned", converted !== null);
  check("converted item is in inventory", db.getItem(alice.id, converted!.id)?.name === "Alice's dream teapot");
  check("converted item has updated price", db.getItem(alice.id, converted!.id)?.purchasePrice === 40);
  check("converted item removed from wishlist", db.getWishlistItem(alice.id, aWish.id) === null);
  check("alice wishlist is now empty", db.listWishlist(alice.id).length === 0);
  db.deleteItem(alice.id, converted!.id);
}

/* --------------------------------------------------- bootstrap claiming */

{
  // A legacy database has ownerless rows. They land on the bootstrap
  // account (is_bootstrap = 1) and are claimed by the first real
  // registration, so no inventory is orphaned by the migration.
  const alice = db.getUserByEmail("alice@example.com")!;
  const bob = db.getUserByEmail("bob@example.com")!;

  const legacy = db.createUser("legacy@declutter.invalid", "Legacy", hashPassword("x"));
  d.prepare("UPDATE users SET is_bootstrap = 1 WHERE id = ?").run(legacy.id);
  // Everything that existed before accounts lands on the bootstrap holder.
  d.prepare("UPDATE items SET owner_id = ? WHERE owner_id IN (?, ?)").run(
    legacy.id,
    alice.id,
    bob.id
  );
  d.prepare("UPDATE wishlist_items SET owner_id = ? WHERE owner_id IN (?, ?)").run(
    legacy.id,
    alice.id,
    bob.id
  );

  // The bootstrap account cannot log in — it has no password.
  check(
    "the bootstrap account is flagged as bootstrap",
    db.getUserByEmail("legacy@declutter.invalid")?.isBootstrap === true
  );
  check("the bootstrap account holds the legacy items", db.listItems(legacy.id).length === 2);

  const claimant = db.createUser("claimant@example.com", "Claimant", hashPassword("claimpassword"));
  db.claimBootstrapData(claimant.id);

  const claimed = db.listItems(claimant.id);
  check("claiming moves items to the new account", claimed.length === 2, claimed.length);
  check(
    "claimed items keep their names",
    claimed.map((i) => i.name).sort().join(",") === "Alice's kettle,Bob's kettle",
    claimed.map((i) => i.name).join(",")
  );
  check("the old holder keeps nothing", db.listItems(legacy.id).length === 0);
  const remaining = d
    .prepare("SELECT COUNT(*) c FROM users WHERE id = ?")
    .get(String(legacy.id)) as { c: number };
  check("the bootstrap account is retired after claiming", remaining.c === 0, remaining.c);
  check("claimed wishlist items move too", db.listWishlist(claimant.id).length === 1);
}

/* ---------------------------------------------------- subscriptions */

{
  const subUser = db.createUser("sub@example.com", "SubUser", hashPassword("password123"));
  check("user defaults to free plan", subUser.plan === "free");
  check("user defaults to null subscription interval", subUser.subscriptionInterval === null);

  const upgraded = db.updateUserSubscription(subUser.id, "premium", "monthly", "2026-12-23");
  check("upgraded user is premium", upgraded?.plan === "premium");
  check("upgraded interval is monthly", upgraded?.subscriptionInterval === "monthly");
  check("upgraded renewsAt matches", upgraded?.subscriptionRenewsAt === "2026-12-23");

  const yearly = db.updateUserSubscription(subUser.id, "premium", "yearly", "2027-11-23");
  check("switched interval is yearly", yearly?.subscriptionInterval === "yearly");
  check("switched renewsAt is yearly", yearly?.subscriptionRenewsAt === "2027-11-23");

  const cancelled = db.updateUserSubscription(subUser.id, "free", null, null);
  check("cancelled user returns to free", cancelled?.plan === "free");
  check("cancelled user has no interval", cancelled?.subscriptionInterval === null);
}

/* ---------------------------------------------------- user categories */

{
  const catUser = db.createUser("categories@example.com", "CatUser", hashPassword("password123"));
  const initialCats = db.listUserCategories(catUser.id);
  check("new user has default categories", initialCats.length >= 8);

  db.addUserCategory(catUser.id, "photography");
  db.addUserSubcategory(catUser.id, "photography", "Lenses");
  let updatedCats = db.listUserCategories(catUser.id);
  const photoCat = updatedCats.find((c) => c.category === "photography");
  check("custom category added", Boolean(photoCat));
  check("custom subcategory added", photoCat?.subcategories.includes("Lenses") === true);

  db.renameUserCategory(catUser.id, "photography", "camera gear");
  updatedCats = db.listUserCategories(catUser.id);
  const renamed = updatedCats.find((c) => c.category === "camera gear");
  check("category renamed", Boolean(renamed));
  check("subcategories preserved on category rename", renamed?.subcategories.includes("Lenses") === true);

  db.renameUserSubcategory(catUser.id, "camera gear", "Lenses", "Prime Lenses");
  updatedCats = db.listUserCategories(catUser.id);
  const updatedSub = updatedCats.find((c) => c.category === "camera gear");
  check("subcategory renamed", updatedSub?.subcategories.includes("Prime Lenses") === true);

  db.deleteUserSubcategory(catUser.id, "camera gear", "Prime Lenses");
  updatedCats = db.listUserCategories(catUser.id);
  check("subcategory deleted", updatedCats.find((c) => c.category === "camera gear")?.subcategories.includes("Prime Lenses") === false);

  db.deleteUserCategory(catUser.id, "camera gear");
  updatedCats = db.listUserCategories(catUser.id);
  check("category deleted", !updatedCats.some((c) => c.category === "camera gear"));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
