import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR, createUser, createItem, getItem, listItems, getDb } from "../lib/db.ts";
import { cleanupOrphanedPhotos } from "../lib/storage.ts";
import { formatFileSize } from "../lib/image-compression.ts";
import { createZip } from "../lib/zip.ts";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function eq(name: string, actual: unknown, expected: unknown) {
  check(
    name,
    actual === expected,
    `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`
  );
}

async function run() {
  console.log("Starting features & photo cleanup test suite...");

  // 1. Test image compression formatFileSize utility
  eq("formatFileSize 0 bytes", formatFileSize(0), "0 B");
  eq("formatFileSize KB", formatFileSize(1024), "1 KB");
  eq("formatFileSize fractional KB", formatFileSize(1536), "1.5 KB");
  eq("formatFileSize MB", formatFileSize(1024 * 1024 * 2.5), "2.5 MB");

  // 2. Setup user and files in UPLOAD_DIR
  const user = createUser("features-test@example.com", "Feature Tester", "pass123");
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const activePhoto = "u1-item-123-active.jpg";
  const orphanPhoto1 = "u1-item-999-orphan.jpg";
  const orphanPhoto2 = "u1-avatar-orphan.jpg";

  fs.writeFileSync(path.join(UPLOAD_DIR, activePhoto), "active content here");
  fs.writeFileSync(path.join(UPLOAD_DIR, orphanPhoto1), "orphan 1 content");
  fs.writeFileSync(path.join(UPLOAD_DIR, orphanPhoto2), "orphan 2 content");

  // Create item referencing activePhoto
  const item1 = createItem(user.id, {
    name: "Active Camera",
    category: "electronics",
    description: "",
    location: "Studio",
    purchaseDate: "2026-01-01",
    purchasePrice: 500,
    currentValue: 450,
    status: "owned",
    lastUsedAt: "2026-02-01",
    useFrequency: "monthly",
    photoPath: activePhoto,
    priority: "auto",
  });

  check("Item created with photoPath", item1.photoPath === activePhoto);
  check("Active photo file exists", fs.existsSync(path.join(UPLOAD_DIR, activePhoto)));
  check("Orphan photo 1 exists before cleanup", fs.existsSync(path.join(UPLOAD_DIR, orphanPhoto1)));
  check("Orphan photo 2 exists before cleanup", fs.existsSync(path.join(UPLOAD_DIR, orphanPhoto2)));

  // Run cleanupOrphanedPhotos
  const res = await cleanupOrphanedPhotos();
  check("Cleanup completed successfully", res !== null);
  eq("Cleanup deleted 2 orphan files", res.deleted, 2);
  check("Freed bytes > 0", res.freedBytes > 0);
  check("Active photo still exists", fs.existsSync(path.join(UPLOAD_DIR, activePhoto)));
  check("Orphan photo 1 was removed", !fs.existsSync(path.join(UPLOAD_DIR, orphanPhoto1)));
  check("Orphan photo 2 was removed", !fs.existsSync(path.join(UPLOAD_DIR, orphanPhoto2)));

  // 3. Test Bulk Operations logic
  const item2 = createItem(user.id, {
    name: "Winter Boots",
    category: "clothing",
    description: "",
    location: "Closet",
    purchaseDate: "2025-11-01",
    purchasePrice: 120,
    currentValue: 80,
    status: "owned",
    lastUsedAt: "2026-01-15",
    useFrequency: "seasonal",
    photoPath: null,
    priority: "auto",
  });

  const item3 = createItem(user.id, {
    name: "Old Toaster",
    category: "appliances",
    description: "",
    location: "Kitchen",
    purchaseDate: "2023-01-01",
    purchasePrice: 40,
    currentValue: 10,
    status: "owned",
    lastUsedAt: "2024-01-01",
    useFrequency: "rare",
    photoPath: null,
    priority: "auto",
  });

  const d = getDb();

  // Test bulk purgatory
  const todayStr = new Date().toISOString().slice(0, 10);
  d.prepare(
    `UPDATE items SET status = 'purgatory', purgatory_date = ? WHERE owner_id = ? AND id IN (?, ?)`
  ).run(todayStr, user.id, item2.id, item3.id);

  const updated2 = getItem(user.id, item2.id);
  const updated3 = getItem(user.id, item3.id);
  eq("Item 2 moved to purgatory", updated2?.status, "purgatory");
  eq("Item 3 moved to purgatory", updated3?.status, "purgatory");
  eq("Item 2 has purgatoryDate", updated2?.purgatoryDate, todayStr);

  // Test bulk category update
  d.prepare(
    `UPDATE items SET category = ?, subcategory = '' WHERE owner_id = ? AND id IN (?, ?)`
  ).run("kitchen", user.id, item1.id, item3.id);

  eq("Item 1 category updated to kitchen", getItem(user.id, item1.id)?.category, "kitchen");
  eq("Item 3 category updated to kitchen", getItem(user.id, item3.id)?.category, "kitchen");

  // Test bulk priority update
  d.prepare(
    `UPDATE items SET priority = ? WHERE owner_id = ? AND id IN (?, ?)`
  ).run("keep", user.id, item1.id, item2.id);

  eq("Item 1 priority updated to keep", getItem(user.id, item1.id)?.priority, "keep");
  eq("Item 2 priority updated to keep", getItem(user.id, item2.id)?.priority, "keep");

  // 4. Test zip archive creation
  const zipBuffer = createZip([
    { name: "smpl-export/inventory.csv", data: "id,name\n1,laptop" },
    { name: "smpl-export/backup.json", data: JSON.stringify({ test: true }) },
  ]);
  check("createZip produces non-empty buffer", zipBuffer.length > 0);
  check("createZip has standard zip header signature", zipBuffer.readUInt32LE(0) === 0x04034b50);

  console.log(`\nFeatures tests: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
