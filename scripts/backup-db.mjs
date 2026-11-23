/**
 * Off-site SQLite and JSON data backup utility.
 * Backs up the SQLite database snapshot and complete JSON data archive to Cloudflare R2 / S3.
 * Can be run manually or as a cron / container pre-shutdown task:
 *   node scripts/backup-db.mjs
 */
import { performDatabaseBackup } from "../lib/backup.ts";

async function main() {
  console.log("Starting full database & data backup...");
  const result = await performDatabaseBackup();

  if (result.ok) {
    console.log("Backup completed successfully!");
    console.log(`- Timestamp: ${result.timestamp}`);
    console.log(`- Uploaded to Cloudflare R2 / S3: ${result.uploadedToCloud ? "YES" : "NO (local only)"}`);
    console.log(`- SQLite Snapshot: ${Math.round((result.sqliteSize || 0) / 1024)} KB`);
    console.log(`- JSON Data Archive: ${Math.round((result.jsonSize || 0) / 1024)} KB`);
    console.log(`- Records: ${JSON.stringify(result.counts)}`);
  } else {
    console.error("Backup failed:", result.error);
    process.exitCode = 1;
  }
}

main();
