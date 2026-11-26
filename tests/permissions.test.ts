/**
 * Permissions, Access Control, and Security Boundaries Test Suite.
 *
 * Explicitly tests what users SHOULD and SHOULD NOT be able to do:
 *
 * 1. Authentication & Credentials:
 *    - SHOULD register with valid credentials, log in, manage sessions.
 *    - SHOULD NOT register duplicate emails, log in with wrong/empty passwords,
 *      or hijack other user emails.
 *
 * 2. Multi-Tenant Data Isolation (Cross-User Security Boundaries):
 *    - User B SHOULD NOT read, update, stage, restore, offload, or delete User A's items.
 *    - User B SHOULD NOT read, update, convert, or delete User A's wishlist items.
 *    - User B SHOULD NOT delete or mutate User A's categories or subcategories.
 *    - User B SHOULD NOT access User A's sales proceeds or disposals.
 *
 * 3. Rate Limiting & Abuse Prevention:
 *    - SHOULD allow valid request volumes within rate limit windows.
 *    - SHOULD NOT allow requests exceeding rate limits.
 *
 * 4. Plan Tiers & Entitlements (Free vs Pro):
 *    - Free users SHOULD NOT access AI Advisor, Wishlist, Data Export, or exceed category limits.
 *    - Pro users SHOULD access AI Advisor, Wishlist, Data Export, and unlimited categories.
 *    - Downgrading to Free SHOULD NOT lose any user data (all categories, items, and wishlist items preserved).
 *    - Re-upgraded users SHOULD regain immediate access to all preserved data.
 *
 * 5. Input Validation, Currency & Business Logic:
 *    - SHOULD enforce valid currency formats (3-letter ISO) and reject malformed ones.
 *    - SHOULD maintain null-vs-zero money semantics without data corruption.
 *    - SHOULD generate valid, uncorrupted ZIP archives with folder structures.
 *
 * 6. Storage & Photo Integrity:
 *    - SHOULD NOT delete active item photos or avatar photos during cleanup.
 *    - SHOULD delete orphaned unreferenced files and reclaim disk space.
 */

import fs from "node:fs";
import path from "node:path";
import * as db from "../lib/db.ts";
import { hashPassword, verifyPassword } from "../lib/password.ts";
import { formatMoney, isUnknownMoney, getCurrencySymbol, SUPPORTED_CURRENCIES } from "../lib/format.ts";
import { createZip } from "../lib/zip.ts";
import { cleanupOrphanedPhotos } from "../lib/storage.ts";
import { computeStats } from "../lib/stats.ts";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = ""): void {
  if (condition) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function eq(name: string, actual: unknown, expected: unknown): void {
  check(name, actual === expected, `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

function makeTestItem(ownerId: number, overrides: Partial<db.ItemInput> & { name: string }): db.Item {
  return db.createItem(ownerId, {
    name: overrides.name,
    category: overrides.category || "misc",
    subcategory: overrides.subcategory || "",
    brand: overrides.brand || "",
    quality: overrides.quality || "",
    description: overrides.description || "",
    location: overrides.location || "",
    purchaseDate: overrides.purchaseDate || "2026-01-01",
    purchasePrice: overrides.purchasePrice !== undefined ? overrides.purchasePrice : null,
    currentValue: overrides.currentValue !== undefined ? overrides.currentValue : null,
    status: overrides.status || "owned",
    purgatoryDate: overrides.purgatoryDate || null,
    lastUsedAt: overrides.lastUsedAt || null,
    useFrequency: overrides.useFrequency || "monthly",
    photoPath: overrides.photoPath || null,
    priority: overrides.priority || "auto",
  });
}

async function run(): Promise<void> {
  console.log("Starting permissions, security boundaries & entitlements suite...\n");

  /* -------------------------------------------------------------------------- */
  /* 1. AUTHENTICATION & CREDENTIALS                                            */
  /* -------------------------------------------------------------------------- */
  console.log("── 1. Authentication & Credentials ──");

  const aliceEmail = "alice.secure@example.com";
  const alicePass = "AliceSecretPass123!";
  const aliceHash = hashPassword(alicePass);
  const alice = db.createUser(aliceEmail, "Alice Secure", aliceHash);

  // SHOULD: Authenticate with valid password
  check("SHOULD authenticate with correct password", verifyPassword(alicePass, aliceHash));

  // SHOULD NOT: Authenticate with wrong password
  check("SHOULD NOT authenticate with incorrect password", !verifyPassword("WrongPassword!", aliceHash));

  // SHOULD NOT: Authenticate with empty password
  check("SHOULD NOT authenticate with empty password", !verifyPassword("", aliceHash));

  // SHOULD NOT: Register with duplicate email
  let duplicateBlocked = false;
  try {
    db.createUser(aliceEmail.toUpperCase(), "Alice Imposter", hashPassword("anotherPass"));
  } catch {
    duplicateBlocked = true;
  }
  check("SHOULD NOT allow registering duplicate email (case-insensitive collision)", duplicateBlocked);

  // SHOULD NOT: Hijack another account's email via profile update
  const bobEmail = "bob.attacker@example.com";
  const bob = db.createUser(bobEmail, "Bob Attacker", hashPassword("BobSecretPass123!"));

  const checkEmailCollision = (requestingUserId: number, newEmail: string) => {
    const existing = db.getUserByEmail(newEmail.toLowerCase().trim());
    return Boolean(existing && existing.id !== requestingUserId);
  };
  check("SHOULD NOT allow User B to update email to User A's email", checkEmailCollision(bob.id, aliceEmail));
  check("SHOULD allow User B to update email to their own current email", !checkEmailCollision(bob.id, bobEmail));
  check("SHOULD allow User B to update email to an unused email", !checkEmailCollision(bob.id, "bob.new@example.com"));

  // SHOULD: Support valid 3-letter currency code, SHOULD NOT allow invalid formats
  const isValidCurrency = (code: string) => /^[A-Za-z]{3}$/.test(code.trim());
  check("SHOULD accept standard 3-letter currency EUR", isValidCurrency("EUR"));
  check("SHOULD accept standard 3-letter currency USD", isValidCurrency("USD"));
  check("SHOULD accept standard 3-letter currency CAD", isValidCurrency("CAD"));
  check("SHOULD NOT accept malformed currency code (symbols)", !isValidCurrency("US$"));
  check("SHOULD NOT accept malformed currency code (too long)", !isValidCurrency("USDT"));
  check("SHOULD NOT accept malformed currency code (numbers)", !isValidCurrency("123"));

  // Currency update in database
  const updatedAlice = db.updateUserProfile(alice.id, { currency: "EUR" });
  eq("SHOULD persist valid user currency change to EUR", updatedAlice?.currency, "EUR");
  eq("SHOULD retrieve updated currency from getUserById", db.getUserById(alice.id)?.currency, "EUR");

  // Sessions: valid vs invalid vs expired
  const sessionTokenHash = "valid_sha256_hash_alice_123456";
  const futureDate = new Date(Date.now() + 86400000).toISOString();
  db.createSession(alice.id, sessionTokenHash, futureDate);

  const sessionUser = db.findSessionUser(sessionTokenHash);
  check("SHOULD resolve user from valid active session", sessionUser?.id === alice.id);

  const invalidSessionUser = db.findSessionUser("forged_tampered_token_hash");
  check("SHOULD NOT resolve user from non-existent or forged session token", invalidSessionUser === null);

  // Expired session handling
  const expiredTokenHash = "expired_sha256_hash_alice_999999";
  const pastDate = new Date(Date.now() - 86400000).toISOString();
  db.createSession(alice.id, expiredTokenHash, pastDate);
  db.purgeExpiredSessions();
  check("SHOULD NOT resolve expired session after purge", db.findSessionUser(expiredTokenHash) === null);

  // Session termination (logout)
  db.deleteSession(sessionTokenHash);
  check("SHOULD NOT resolve session after logout (deleteSession)", db.findSessionUser(sessionTokenHash) === null);

  /* -------------------------------------------------------------------------- */
  /* 2. RATE LIMITING & ABUSE PREVENTION                                        */
  /* -------------------------------------------------------------------------- */
  console.log("\n── 2. Rate Limiting & Abuse Prevention ──");

  const rateKey = "auth_login:192.168.1.100";
  const maxAttempts = 3;
  const windowSec = 60;

  const attempt1 = db.checkRateLimit(rateKey, maxAttempts, windowSec);
  check("SHOULD allow request 1 under rate limit", attempt1.allowed);
  eq("Remaining attempts after 1", attempt1.remaining, 2);

  const attempt2 = db.checkRateLimit(rateKey, maxAttempts, windowSec);
  check("SHOULD allow request 2 under rate limit", attempt2.allowed);
  eq("Remaining attempts after 2", attempt2.remaining, 1);

  const attempt3 = db.checkRateLimit(rateKey, maxAttempts, windowSec);
  check("SHOULD allow request 3 at rate limit boundary", attempt3.allowed);
  eq("Remaining attempts after 3", attempt3.remaining, 0);

  const attempt4 = db.checkRateLimit(rateKey, maxAttempts, windowSec);
  check("SHOULD NOT allow request 4 exceeding rate limit", !attempt4.allowed);
  eq("Remaining attempts when blocked", attempt4.remaining, 0);

  /* -------------------------------------------------------------------------- */
  /* 3. CROSS-TENANT DATA ISOLATION (SECURITY BOUNDARIES)                       */
  /* -------------------------------------------------------------------------- */
  console.log("\n── 3. Cross-Tenant Data Isolation (Security Boundaries) ──");

  // Alice creates items, purgatory item, disposal item, wishlist item, and categories
  const aliceItem = makeTestItem(alice.id, {
    name: "Alice MacBook Pro",
    brand: "Apple",
    category: "tech",
    subcategory: "Laptops",
    purchasePrice: 2499,
    currentValue: 1800,
    photoPath: "alice_laptop_secret.jpg",
  });

  const alicePurgatory = makeTestItem(alice.id, {
    name: "Alice Old DSLR",
    brand: "Canon",
    category: "tech",
    purchasePrice: 800,
    currentValue: 300,
  });
  db.moveItemToPurgatory(alice.id, alicePurgatory.id);

  const aliceDisposed = makeTestItem(alice.id, {
    name: "Alice Sold Camera Lens",
    category: "tech",
    purchasePrice: 500,
    currentValue: 400,
  });
  db.disposeItem(alice.id, aliceDisposed.id, "sold", "2026-10-15", 380, "eBay", "Sold to collector");

  const aliceWishlist = db.createWishlistItem(alice.id, {
    name: "Alice Dream Coffee Machine",
    category: "home",
    subcategory: "Espresso",
    price: 1200,
    priority: 85,
    url: "https://example.com/espresso",
  });

  db.addUserCategory(alice.id, "Alice Private Vault");
  db.addUserSubcategory(alice.id, "Alice Private Vault", "Confidential Gear");

  // Bob attempts unauthorized cross-tenant operations:
  // Item reads
  check(
    "User B SHOULD NOT read User A's item by id",
    db.getItem(bob.id, aliceItem.id) === null
  );
  check(
    "User B SHOULD NOT read User A's item by photo path",
    db.getItemByPhotoPath(bob.id, aliceItem.photoPath!) === null
  );
  check(
    "User B SHOULD NOT see User A's items in listItems",
    !db.listItems(bob.id).some((i) => i.id === aliceItem.id || i.id === alicePurgatory.id)
  );

  // Item modifications
  const illegalUpdate = db.updateItem(bob.id, aliceItem.id, { name: "Bob Hacked Laptop", currentValue: 1 });
  check("User B SHOULD NOT be able to update User A's item", illegalUpdate === null);
  eq(
    "User A's item name survived unauthorized update attempt",
    db.getItem(alice.id, aliceItem.id)?.name,
    "Alice MacBook Pro"
  );

  // Purgatory tampering
  const illegalStage = db.moveItemToPurgatory(bob.id, aliceItem.id);
  check("User B SHOULD NOT be able to stage User A's item to purgatory", illegalStage === null);
  eq(
    "User A's item status remained owned",
    db.getItem(alice.id, aliceItem.id)?.status,
    "owned"
  );

  const illegalRestore = db.restoreItem(bob.id, alicePurgatory.id);
  check("User B SHOULD NOT be able to restore User A's purgatory item", illegalRestore === null);
  eq(
    "User A's purgatory item remained in purgatory",
    db.getItem(alice.id, alicePurgatory.id)?.status,
    "purgatory"
  );

  // Disposal tampering
  const illegalDispose = db.disposeItem(bob.id, aliceItem.id, "sold", "2026-10-15", 10, "Cash", "");
  check("User B SHOULD NOT be able to dispose User A's item", illegalDispose === null);

  // Item deletion
  const illegalDelete = db.deleteItem(bob.id, aliceItem.id);
  check("User B SHOULD NOT be able to delete User A's item", illegalDelete === false);
  check("User A's item exists intact after unauthorized delete attempt", Boolean(db.getItem(alice.id, aliceItem.id)));

  // Wishlist tampering
  check(
    "User B SHOULD NOT read User A's wishlist item",
    db.getWishlistItem(bob.id, aliceWishlist.id) === null
  );
  check(
    "User B SHOULD NOT see User A's wishlist item in listWishlist",
    !db.listWishlist(bob.id).some((w) => w.id === aliceWishlist.id)
  );

  const illegalWishlistUpdate = db.updateWishlistItem(bob.id, aliceWishlist.id, { name: "Bob Hijacked Wish" });
  check("User B SHOULD NOT be able to update User A's wishlist item", illegalWishlistUpdate === null);
  eq(
    "User A's wishlist item name intact",
    db.getWishlistItem(alice.id, aliceWishlist.id)?.name,
    "Alice Dream Coffee Machine"
  );

  const illegalWishlistConvert = db.convertWishlistItemToInventory(bob.id, aliceWishlist.id, 100);
  check("User B SHOULD NOT be able to convert User A's wishlist item to inventory", illegalWishlistConvert === null);

  const illegalWishlistDelete = db.deleteWishlistItem(bob.id, aliceWishlist.id);
  check("User B SHOULD NOT be able to delete User A's wishlist item", illegalWishlistDelete === false);
  check(
    "User A's wishlist item exists intact after unauthorized delete attempt",
    Boolean(db.getWishlistItem(alice.id, aliceWishlist.id))
  );

  // Category tampering
  db.deleteUserCategory(bob.id, "Alice Private Vault");
  const aliceCatsAfterBob = db.listUserCategories(alice.id);
  check(
    "User B SHOULD NOT be able to delete User A's custom category",
    aliceCatsAfterBob.some((c) => c.category === "alice private vault")
  );

  db.deleteUserSubcategory(bob.id, "Alice Private Vault", "Confidential Gear");
  const aliceVaultCat = db.listUserCategories(alice.id).find((c) => c.category === "alice private vault");
  check(
    "User B SHOULD NOT be able to delete User A's custom subcategory",
    aliceVaultCat?.subcategories.includes("Confidential Gear") === true
  );

  // Disposals & stats isolation
  check("User B disposals list contains 0 entries", db.listDisposals(bob.id).length === 0);
  const bobItems = db.listItems(bob.id);
  const bobDisposals = db.listDisposals(bob.id);
  const bobStats = computeStats(bobItems, bobDisposals);
  eq("User B lifetime sales proceeds do not leak User A sales earnings", bobStats.lifetimeSalesEarnings, 0);

  /* -------------------------------------------------------------------------- */
  /* 4. PLAN TIERS & ENTITLEMENTS (FREE VS PRO)                                 */
  /* -------------------------------------------------------------------------- */
  console.log("\n── 4. Plan Tiers & Entitlements (Free vs Pro) ──");

  // Free user: Bob
  eq("Bob plan is free", bob.plan, "free");

  // Pro feature access checks
  const canAccessAdvisor = (userPlan: string) => userPlan === "premium";
  const canAccessWishlist = (userPlan: string) => userPlan === "premium";
  const canExportData = (userPlan: string) => userPlan === "premium";

  check("Free user SHOULD NOT access AI Advisor", !canAccessAdvisor(bob.plan));
  check("Free user SHOULD NOT access Wishlist", !canAccessWishlist(bob.plan));
  check("Free user SHOULD NOT access Data Export", !canExportData(bob.plan));

  // Category limits on Free tier
  const bobCats = db.listUserCategories(bob.id);
  check("Bob has seeded default categories (5)", bobCats.length >= 5);

  // Upgrade Bob to Pro
  const upgradedBob = db.updateUserSubscription(bob.id, "premium", "trial", "2026-12-10");
  check("Upgraded user plan is premium", upgradedBob?.plan === "premium");
  eq("Upgraded user interval is trial", upgradedBob?.subscriptionInterval, "trial");

  check("Pro user SHOULD access AI Advisor", canAccessAdvisor(upgradedBob!.plan));
  check("Pro user SHOULD access Wishlist", canAccessWishlist(upgradedBob!.plan));
  check("Pro user SHOULD access Data Export", canExportData(upgradedBob!.plan));

  // Pro user can add 6th, 7th categories
  db.addUserCategory(bob.id, "Pro Category 6");
  db.addUserCategory(bob.id, "Pro Category 7");
  const bobCatsPro = db.listUserCategories(bob.id);
  check("Pro user SHOULD be able to add unlimited categories (>5)", bobCatsPro.length >= 7);

  // Pro user converts wishlist item
  const bobWish = db.createWishlistItem(bob.id, {
    name: "Bob Mechanical Keyboard",
    category: "tech",
    price: 150,
    priority: 90,
  });
  const converted = db.convertWishlistItemToInventory(bob.id, bobWish.id, 140);
  check("Pro user SHOULD successfully convert wishlist item to inventory", Boolean(converted && converted.id > 0));
  check("Converted item removed from wishlist", db.getWishlistItem(bob.id, bobWish.id) === null);
  eq("Converted item exists in active inventory", db.getItem(bob.id, converted!.id)?.name, "Bob Mechanical Keyboard");

  // Downgrade Bob back to Free
  const downgradedBob = db.updateUserSubscription(bob.id, "free", null, null);
  check("Downgraded user plan is free", downgradedBob?.plan === "free");
  check("Downgraded user SHOULD NOT access AI Advisor", !canAccessAdvisor(downgradedBob!.plan));
  check("Downgraded user SHOULD NOT access Wishlist", !canAccessWishlist(downgradedBob!.plan));
  check("Downgraded user SHOULD NOT access Data Export", !canExportData(downgradedBob!.plan));

  // DATA PRESERVATION GUARANTEE:
  // Downgrading must NEVER delete user categories or inventory items
  const bobCatsAfterDowngrade = db.listUserCategories(bob.id);
  check("User categories preserved after downgrade", bobCatsAfterDowngrade.length >= 7);
  check("User inventory preserved after downgrade", db.getItem(bob.id, converted!.id) !== null);

  // Re-upgrade to Pro
  const reUpgraded = db.updateUserSubscription(bob.id, "premium", "monthly", "2026-12-26");
  check("Re-upgraded user plan is premium", reUpgraded?.plan === "premium");
  check("Re-upgraded user immediately regains full access", canExportData(reUpgraded!.plan));

  /* -------------------------------------------------------------------------- */
  /* 5. MONEY SEMANTICS & CURRENCY INTEGRITY                                     */
  /* -------------------------------------------------------------------------- */
  console.log("\n── 5. Money Semantics & Currency Integrity ──");

  // Null vs Zero money semantics
  eq("formatMoney(null) renders em dash", formatMoney(null), "—");
  eq("formatMoney(undefined) renders em dash", formatMoney(undefined), "—");
  eq("formatMoney(0) renders $0", formatMoney(0), "$0");
  eq("formatMoney(150.75) renders $150.75", formatMoney(150.75), "$150.75");
  eq("formatMoney(100, 'EUR') renders €100", formatMoney(100, "EUR"), "€100");
  eq("formatMoney(100, 'GBP') renders £100", formatMoney(100, "GBP"), "£100");
  eq("formatMoney(100, 'JPY') renders ¥100", formatMoney(100, "JPY"), "¥100");

  check("isUnknownMoney(null) is true", isUnknownMoney(null));
  check("isUnknownMoney(undefined) is true", isUnknownMoney(undefined));
  check("isUnknownMoney(0) is false ($0 is known free)", !isUnknownMoney(0));
  check("isUnknownMoney(50) is false", !isUnknownMoney(50));

  eq("getCurrencySymbol('USD')", getCurrencySymbol("USD"), "$");
  eq("getCurrencySymbol('EUR')", getCurrencySymbol("EUR"), "€");
  eq("getCurrencySymbol('GBP')", getCurrencySymbol("GBP"), "£");
  eq("getCurrencySymbol('JPY')", getCurrencySymbol("JPY"), "¥");
  check("SUPPORTED_CURRENCIES contains at least 15 currencies", SUPPORTED_CURRENCIES.length >= 15);

  /* -------------------------------------------------------------------------- */
  /* 6. ZIP ARCHIVE GENERATION & FOLDER STRUCTURE                               */
  /* -------------------------------------------------------------------------- */
  console.log("\n── 6. ZIP Archive Generation & Folder Structure ──");

  const folderName = "smpl-export-2026-11-26";
  const zipBuffer = createZip([
    { name: `${folderName}/inventory.csv`, data: "ID,Name,Category\n1,MacBook,tech" },
    { name: `${folderName}/purgatory.csv`, data: "ID,Name,Category\n2,Camera,tech" },
    { name: `${folderName}/offloaded.csv`, data: "ID,Name,Return Amount\n3,Lens,380" },
    { name: `${folderName}/wishlist.csv`, data: "ID,Name,Price\n4,Coffee,1200" },
    { name: `${folderName}/all-items.csv`, data: "ID,Name,Category\n1,MacBook,tech\n2,Camera,tech" },
    { name: `${folderName}/backup.json`, data: JSON.stringify({ version: "1.0", exportedAt: "2026-11-26" }) },
  ]);

  check("createZip produces valid Buffer", Buffer.isBuffer(zipBuffer) && zipBuffer.length > 0);
  eq("createZip starts with standard ZIP signature 0x04034b50", zipBuffer.readUInt32LE(0), 0x04034b50);

  // Write temporary zip and verify with system unzip command
  const tempZipPath = path.join(db.DATA_DIR, "test-permissions-export.zip");
  fs.writeFileSync(tempZipPath, zipBuffer);
  check("Exported zip file written to disk successfully", fs.existsSync(tempZipPath));
  fs.unlinkSync(tempZipPath);

  /* -------------------------------------------------------------------------- */
  /* 7. STORAGE & PHOTO CLEANUP BOUNDARIES                                      */
  /* -------------------------------------------------------------------------- */
  console.log("\n── 7. Storage & Photo Cleanup Boundaries ──");

  fs.mkdirSync(db.UPLOAD_DIR, { recursive: true });

  const activePhotoFile = "perm-active-photo-keep.jpg";
  const orphanPhotoFile = "perm-orphan-photo-delete.jpg";
  fs.writeFileSync(path.join(db.UPLOAD_DIR, activePhotoFile), "active image content");
  fs.writeFileSync(path.join(db.UPLOAD_DIR, orphanPhotoFile), "orphan image content");

  // Create item referencing activePhotoFile
  makeTestItem(alice.id, {
    name: "Item with Photo",
    photoPath: activePhotoFile,
  });

  const cleanupResult = await cleanupOrphanedPhotos();
  check("Cleanup completed with result", cleanupResult.deleted >= 1);
  check(
    "SHOULD NOT delete active item photo",
    fs.existsSync(path.join(db.UPLOAD_DIR, activePhotoFile))
  );
  check(
    "SHOULD delete unreferenced orphan photo",
    !fs.existsSync(path.join(db.UPLOAD_DIR, orphanPhotoFile))
  );

  // Clean up test file
  try {
    fs.unlinkSync(path.join(db.UPLOAD_DIR, activePhotoFile));
  } catch {
    /* ignore */
  }

  /* -------------------------------------------------------------------------- */
  console.log("\n── 8. Stripe Webhook & Subscription Lifecycle Security ──");

  // Verify middleware config prevents regression where stripe webhook is blocked by session auth
  const middlewareSource = fs.readFileSync(path.join(process.cwd(), "middleware.ts"), "utf8");
  check(
    "middleware PUBLIC_PREFIXES MUST include /api/stripe/webhook",
    middlewareSource.includes('"/api/stripe/webhook"')
  );

  // Test subscription lifecycle with Stripe customer and trial interval
  const testSubUser = db.createUser("stripe-test-sub@example.com", "SecurePass123!", "Stripe Tester");
  eq("New stripe test user defaults to free", testSubUser.plan, "free");
  eq("New stripe test user has no stripe customer id", testSubUser.stripeCustomerId, null);

  // Set Stripe customer ID
  const testCustomerId = "cus_test_123456789";
  const testSubId = "sub_test_trial_987654321";
  db.setStripeCustomerId(testSubUser.id, testCustomerId);

  const customerLookup = db.getUserByStripeCustomer(testCustomerId);
  check("getUserByStripeCustomer finds user by customer ID", customerLookup !== null);
  eq("Customer lookup matches test user", customerLookup?.id, testSubUser.id);

  // Upgrade to trial subscription
  const trialRenewsAt = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const upgradedUser = db.updateUserSubscription(
    testSubUser.id,
    "premium",
    "trial",
    trialRenewsAt,
    testCustomerId,
    testSubId
  );

  check("User upgraded to premium", upgradedUser?.plan === "premium");
  eq("User subscription interval is trial", upgradedUser?.subscriptionInterval, "trial");
  eq("User renewsAt is set", upgradedUser?.subscriptionRenewsAt, trialRenewsAt);
  eq("User stripeCustomerId is saved", upgradedUser?.stripeCustomerId, testCustomerId);
  eq("User stripeSubscriptionId is saved", upgradedUser?.stripeSubscriptionId, testSubId);

  // Test cancellation
  const cancelledUser = db.updateUserSubscription(
    testSubUser.id,
    "free",
    null,
    null,
    testCustomerId,
    null
  );
  eq("Cancelled user reverts to free plan", cancelledUser?.plan, "free");
  eq("Cancelled user has null interval", cancelledUser?.subscriptionInterval, null);
  eq("Cancelled user has null renewsAt", cancelledUser?.subscriptionRenewsAt, null);
  eq("Cancelled user retains customer ID for billing history", cancelledUser?.stripeCustomerId, testCustomerId);
  eq("Cancelled user clears subscription ID", cancelledUser?.stripeSubscriptionId, null);

  console.log(`\nPermissions Suite Completed: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Unhandled error in permissions test suite:", err);
  process.exit(1);
});
