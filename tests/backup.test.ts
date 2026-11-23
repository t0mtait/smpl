import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, createUser, createItem, getDb } from "../lib/db.ts";
import { performDatabaseBackup, getBackupStatus, scheduleAutoBackup } from "../lib/backup.ts";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
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
  console.log("Starting backup test suite...");

  // Setup sample data
  const user = createUser("backup-test@example.com", "Backup Tester", "hash123");
  createItem(user.id, {
    name: "Mechanical Keyboard",
    category: "tech",
    description: "Cherry MX switches",
    location: "Desk",
    purchaseDate: "2026-01-01",
    purchasePrice: 150,
    currentValue: 120,
    status: "owned",
    lastUsedAt: "2026-02-01",
    useFrequency: "daily",
    photoPath: null,
    priority: "auto",
  });

  // Test 1: Initial status before backup
  const initialStatus = getBackupStatus();
  check("Initial status exists", typeof initialStatus === "object");
  check("Initial status has lastStatus", typeof initialStatus.lastStatus === "string");

  // Test 2: Perform backup
  const result = await performDatabaseBackup();
  check("Backup succeeded", result.ok === true);
  check("Backup has timestamp", Boolean(result.timestamp));
  check("Backup has sqliteSize > 0", (result.sqliteSize || 0) > 0);
  check("Backup has jsonSize > 0", (result.jsonSize || 0) > 0);
  check("Backup recorded at least 1 user", (result.counts?.users || 0) >= 1);
  check("Backup recorded at least 1 item", (result.counts?.items || 0) >= 1);

  // Test 3: Check local backup file existence
  const localSqlite = path.join(DATA_DIR, "backups", "smpl-latest.sqlite");
  const localJson = path.join(DATA_DIR, "backups", "smpl-latest.json");
  check("Local sqlite snapshot file created", fs.existsSync(localSqlite));
  check("Local json export file created", fs.existsSync(localJson));

  if (fs.existsSync(localJson)) {
    const raw = fs.readFileSync(localJson, "utf8");
    const parsed = JSON.parse(raw);
    eq("JSON export version is 1", parsed.version, 1);
    check("JSON export has items array", Array.isArray(parsed.data?.items));
    check("JSON export includes created item", parsed.data.items.some((i: { name: string }) => i.name === "Mechanical Keyboard"));
    check("JSON export includes created user", parsed.data.users.some((u: { email: string }) => u.email === "backup-test@example.com"));
  }

  // Test 4: Verify getBackupStatus updated
  const updatedStatus = getBackupStatus();
  eq("Backup status is success", updatedStatus.lastStatus, "success");
  check("Status has lastBackupTime", Boolean(updatedStatus.lastBackupTime));
  check("Status has sqliteSize", (updatedStatus.sqliteSize || 0) > 0);
  check("Status has jsonSize", (updatedStatus.jsonSize || 0) > 0);

  // Test 5: scheduleAutoBackup does not crash
  scheduleAutoBackup(100);
  check("scheduleAutoBackup completed without throwing", true);

  console.log(`Backup tests completed: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Unhandled error in backup tests:", err);
  process.exit(1);
});
