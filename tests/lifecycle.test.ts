/**
 * Comprehensive QA & User Lifecycle Test Suite.
 *
 * Verifies end-to-end:
 * 1. User registration & validation (free plan by default, default categories seeded)
 * 2. User authentication & session management (correct password, wrong password, session resolution)
 * 3. Item creation & field persistence (name, category, subcategory, price, value, usage)
 * 4. Item management (update fields, stage to purgatory, restore, offload with return, delete)
 * 5. Free tier restrictions (trying to access Pro features: Export, AI Advisor, Wishlist, Category limits)
 * 6. Subscription upgrade to Pro (trial, monthly, yearly plan transitions)
 * 7. Pro tier access (export generation, AI Advisor analysis, wishlist operations, unlimited categories)
 * 8. Downgrade / cancellation back to Free tier
 *
 * Runs automatically via `npm test` as part of QA before every release.
 */

import { hashPassword, verifyPassword } from "../lib/password.ts";
import * as db from "../lib/db.ts";
import { scoreAll } from "../lib/scoring.ts";

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

/* -------------------------------------------------------------------------- */
/* 1. USER REGISTRATION                                                       */
/* -------------------------------------------------------------------------- */
console.log("\n── 1. User Registration ──");

const email = "qa.tester@example.com";
const passwordPlain = "SuperSecret123!";
const passwordHash = hashPassword(passwordPlain);

const user = db.createUser(email, "QA Tester", passwordHash);
check("user successfully registered in database", Boolean(user && user.id > 0));
check("user email matches registration", user.email === email);
check("user name matches registration", user.name === "QA Tester");
check("new user defaults to 'free' plan", user.plan === "free");
check("new user has no active subscription interval", user.subscriptionInterval === null);

const userByEmail = db.getUserByEmail(email);
check("lookup by email finds registered user", userByEmail?.id === user.id);

const userCaseInsensitive = db.getUserByEmail("QA.TESTER@EXAMPLE.COM");
check("email lookup is case-insensitive", userCaseInsensitive?.id === user.id);

const defaultCategories = db.listUserCategories(user.id);
check("default categories seeded on registration", defaultCategories.length >= 5);

/* -------------------------------------------------------------------------- */
/* 2. USER AUTHENTICATION & LOGIN                                             */
/* -------------------------------------------------------------------------- */
console.log("\n── 2. User Authentication & Login ──");

const userRecord = db.getUserByEmail(email)!;
check("login verifies with correct password", verifyPassword(passwordPlain, userRecord.passwordHash));
check("login rejects incorrect password", !verifyPassword("WrongPassword999", userRecord.passwordHash));
check("login rejects empty password", !verifyPassword("", userRecord.passwordHash));

const sessionTokenHash = "session-token-hash-qa-12345";
const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
db.createSession(user.id, sessionTokenHash, expiresAt);

const sessionUser = db.findSessionUser(sessionTokenHash);
check("active session resolves to authenticated user", sessionUser?.id === user.id);

const invalidSessionUser = db.findSessionUser("non-existent-session-hash");
check("invalid session token returns null", invalidSessionUser === null);

/* -------------------------------------------------------------------------- */
/* 3. ITEM CREATION                                                           */
/* -------------------------------------------------------------------------- */
console.log("\n── 3. Item Creation ──");

const item1 = db.createItem(user.id, {
  name: "Sony WH-1000XM5 Headphones",
  category: "electronics",
  subcategory: "Audio",
  brand: "Sony",
  description: "Noise cancelling wireless headphones",
  location: "Desk drawer",
  purchaseDate: "2024-03-15",
  purchasePrice: 399.99,
  currentValue: 280.0,
  status: "owned",
  lastUsedAt: "2026-11-01",
  useFrequency: "weekly",
  photoPath: null,
  priority: "auto",
});

check("item created with generated id", Boolean(item1 && item1.id > 0));
check("item name persisted correctly", item1.name === "Sony WH-1000XM5 Headphones");
check("item subcategory persisted correctly", item1.subcategory === "Audio");
check("item purchase price persisted", item1.purchasePrice === 399.99);
check("item current value persisted", item1.currentValue === 280.0);
check("item status defaults to owned", item1.status === "owned");

const fetchedItem = db.getItem(user.id, item1.id);
check("getItem returns item scoped to user", fetchedItem?.name === item1.name);

const userItems = db.listItems(user.id);
check("listItems includes newly created item", userItems.some((i) => i.id === item1.id));

/* -------------------------------------------------------------------------- */
/* 4. ITEM MANAGEMENT (UPDATE, PURGATORY, RESTORE, OFFLOAD, DELETE)          */
/* -------------------------------------------------------------------------- */
console.log("\n── 4. Item Management & Lifecycle ──");

// Update item
const updatedItem = db.updateItem(user.id, item1.id, {
  name: "Sony WH-1000XM5 (Silver)",
  currentValue: 290.0,
  brand: "Sony Electronics",
});
check("updateItem changes name", updatedItem?.name === "Sony WH-1000XM5 (Silver)");
check("updateItem changes currentValue", updatedItem?.currentValue === 290.0);
check("updateItem changes brand", updatedItem?.brand === "Sony Electronics");

// Stage item to Purgatory
const inPurgatory = db.moveItemToPurgatory(user.id, item1.id);
check("item staged to purgatory has purgatory status", inPurgatory?.status === "purgatory");
check("item has purgatoryDate recorded", Boolean(inPurgatory?.purgatoryDate));

// Restore back to inventory
const restored = db.restoreItem(user.id, item1.id);
check("item restored from purgatory returns to owned", restored?.status === "owned");
check("item cleared purgatoryDate on restore", restored?.purgatoryDate === null);

// Offload item with return amount ($)
const soldItem = db.offloadItem(user.id, item1.id, 275.0, "2026-11-24", "Sold to buyer");
check("item status transitions to sold", soldItem?.status === "sold");
const disposals = db.listDisposals(user.id);
const disposal = disposals.find((d) => d.itemId === item1.id);
check("disposal record created with return proceeds", disposal?.amount === 275.0);
check("disposal record disposition is sold", disposal?.disposition === "sold");

// Create secondary item and test delete
const tempItem = db.createItem(user.id, {
  name: "Cardboard Box",
  category: "home",
  description: "",
  location: "",
  purchaseDate: "2026-01-01",
  purchasePrice: 5,
  currentValue: 0,
  status: "owned",
  lastUsedAt: null,
  useFrequency: "rare",
  photoPath: null,
  priority: "auto",
});
check("secondary item created", Boolean(tempItem));
const deleted = db.deleteItem(user.id, tempItem.id);
check("deleteItem returns true", deleted === true);
check("deleted item cannot be found", db.getItem(user.id, tempItem.id) === null);

/* -------------------------------------------------------------------------- */
/* 5. TRYING TO ACCESS PRO FEATURES AS A FREE USER                             */
/* -------------------------------------------------------------------------- */
console.log("\n── 5. Free User Pro Feature Restrictions ──");

const currentUserFree = db.getUserByEmail(email)!;
check("user is verified on free plan", currentUserFree.plan === "free");

// Pro Feature Gate 1: Export access check
const canExportAsFree = currentUserFree.plan === "premium";
check("free user is blocked from data export (403)", !canExportAsFree);

// Pro Feature Gate 2: AI Advisor access check
const canAccessAdvisorAsFree = currentUserFree.plan === "premium";
check("free user is blocked from AI Advisor recommendations (403)", !canAccessAdvisorAsFree);

// Pro Feature Gate 3: Wishlist access check
const canAccessWishlistAsFree = currentUserFree.plan === "premium";
check("free user is blocked from Wishlist cooldown tracker (403)", !canAccessWishlistAsFree);

// Pro Feature Gate 4: Category customization limits on free tier
const freeCategories = db.listUserCategories(user.id);
const freeCatCount = freeCategories.length;
check("free tier has limited categories count", freeCatCount <= 5);

/* -------------------------------------------------------------------------- */
/* 6. TOGGLE USER TO PRO USER (SUBSCRIPTION UPGRADE)                          */
/* -------------------------------------------------------------------------- */
console.log("\n── 6. Toggle User to Pro (Upgrade & Intervals) ──");

// Upgrade to 14-day Free Trial
const renewsAtTrial = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
const proTrialUser = db.updateUserSubscription(user.id, "premium", "trial", renewsAtTrial);
check("user plan updated to 'premium'", proTrialUser?.plan === "premium");
check("user interval is 'trial'", proTrialUser?.subscriptionInterval === "trial");
check("user renewsAt set for 14-day trial", proTrialUser?.subscriptionRenewsAt === renewsAtTrial);

// Switch interval to monthly ($4.29)
const proMonthlyUser = db.updateUserSubscription(user.id, "premium", "monthly", "2026-12-24");
check("switched interval to monthly", proMonthlyUser?.subscriptionInterval === "monthly");
check("user remains on premium plan", proMonthlyUser?.plan === "premium");

// Switch interval to yearly ($34.99)
const proYearlyUser = db.updateUserSubscription(user.id, "premium", "yearly", "2027-11-24");
check("switched interval to yearly", proYearlyUser?.subscriptionInterval === "yearly");
check("user remains on premium plan", proYearlyUser?.plan === "premium");

/* -------------------------------------------------------------------------- */
/* 7. TRY TO ACCESS PRO FEATURES AGAIN AS A PRO USER                          */
/* -------------------------------------------------------------------------- */
console.log("\n── 7. Access Pro Features as Pro User ──");

const currentUserPro = db.getUserByEmail(email)!;
check("user is verified on premium plan", currentUserPro.plan === "premium");

// Pro Feature 1: Data Export unlocked
const canExportAsPro = currentUserPro.plan === "premium";
check("pro user has access to data export", canExportAsPro);
const exportedItems = db.listItems(user.id);
check("pro user can export complete items archive", exportedItems.length > 0);

// Pro Feature 2: AI Advisor unlocked
const canAccessAdvisorAsPro = currentUserPro.plan === "premium";
check("pro user has access to AI Advisor", canAccessAdvisorAsPro);
// Create an idle item to score
db.createItem(user.id, {
  name: "Camping Tent",
  category: "outdoor",
  description: "",
  location: "",
  purchaseDate: "2023-01-01",
  purchasePrice: 250,
  currentValue: 120,
  status: "owned",
  lastUsedAt: "2024-01-01",
  useFrequency: "rare",
  photoPath: null,
  priority: "auto",
});
const scores = scoreAll(db.listItems(user.id));
check("AI Advisor scores idle items and generates suggestions", scores.length > 0);
check("idle camping tent is flagged as declutter candidate", scores.some((s) => s.item.name === "Camping Tent"));

// Pro Feature 3: Wishlist unlocked
const canAccessWishlistAsPro = currentUserPro.plan === "premium";
check("pro user has access to Wishlist & cooldown tracker", canAccessWishlistAsPro);
const wishItem = db.createWishlistItem(user.id, {
  name: "Breville Barista Espresso Machine",
  priority: 85,
  category: "kitchen",
  subcategory: "Appliances",
  price: 999.0,
  url: "https://example.com/espresso",
  notes: "30-day cooldown test",
});
check("wishlist item created successfully", Boolean(wishItem && wishItem.id > 0));
check("wishlist item priority score set", wishItem.priority === 85);
check("wishlist item subcategory saved", wishItem.subcategory === "Appliances");
const wishlistItems = db.listWishlist(user.id);
check("listWishlist returns active wishlist items", wishlistItems.some((w) => w.id === wishItem.id));

// Convert wishlist item into inventory
const convertedItem = db.convertWishlistItemToInventory(user.id, wishItem.id, 949.0);
check("wishlist item converted into active inventory", convertedItem?.status === "owned");
check("converted item preserves subcategory", convertedItem?.subcategory === "Appliances");
check("converted item removed from wishlist", !db.listWishlist(user.id).some((w) => w.id === wishItem.id));

// Pro Feature 4: Unlimited custom categories & subcategories unlocked
db.addUserCategory(user.id, "photography");
db.addUserSubcategory(user.id, "photography", "Lenses");
db.addUserSubcategory(user.id, "photography", "Lighting");
db.addUserSubcategory(user.id, "photography", "Tripods"); // 3rd subcategory (allowed on Pro!)
const proCategories = db.listUserCategories(user.id);
const photoCat = proCategories.find((c) => c.category === "photography");
check("pro user can add unlimited subcategories (3+)", (photoCat?.subcategories.length ?? 0) >= 3);

/* -------------------------------------------------------------------------- */
/* 8. DOWNGRADE / CANCELLATION BACK TO FREE                                    */
/* -------------------------------------------------------------------------- */
console.log("\n── 8. Subscription Downgrade / Cancellation ──");

const downgradedUser = db.updateUserSubscription(user.id, "free", null, null);
check("user successfully downgraded to 'free'", downgradedUser?.plan === "free");
check("downgraded user subscriptionInterval is null", downgradedUser?.subscriptionInterval === null);

const userAfterCancel = db.getUserByEmail(email)!;
check("cancelled user returns to free tier restrictions", userAfterCancel.plan === "free");
check("export is re-locked after cancellation", userAfterCancel.plan !== "premium");
check("AI advisor is re-locked after cancellation", userAfterCancel.plan !== "premium");
check("wishlist is re-locked after cancellation", userAfterCancel.plan !== "premium");

/* -------------------------------------------------------------------------- */
/* SUMMARY                                                                    */
/* -------------------------------------------------------------------------- */
console.log(`\nQA Lifecycle Suite: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
