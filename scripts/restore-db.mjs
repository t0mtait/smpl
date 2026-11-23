/**
 * Disaster recovery restore utility.
 * Restores the SQLite database from the latest Cloudflare R2 / S3 backup:
 *   node scripts/restore-db.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "../lib/db.ts";
import { getFile, isS3Configured, getStorageConfig } from "../lib/storage.ts";

async function main() {
  console.log("Checking Cloudflare R2 / S3 configuration for restore...");
  const config = getStorageConfig();

  if (!config.isConfigured) {
    console.error("Storage is not configured. Missing R2_BUCKET, R2_ENDPOINT, etc.");
    process.exitCode = 1;
    return;
  }

  const targetPath = path.join(DATA_DIR, "smpl.db");
  const candidates = ["backups/smpl-latest.sqlite", "backups/declutter-latest.sqlite"];

  for (const key of candidates) {
    console.log(`Checking ${key} in bucket ${config.bucket}...`);
    try {
      const file = await getFile(key);
      if (file && file.buffer && file.buffer.length > 0) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        // Back up existing local database if present
        if (fs.existsSync(targetPath)) {
          const backupExisting = `${targetPath}.pre-restore-${Date.now()}`;
          console.log(`Moving current local database to ${backupExisting}...`);
          fs.renameSync(targetPath, backupExisting);
        }
        fs.writeFileSync(targetPath, file.buffer);
        console.log(`Successfully restored database from ${key} (${file.buffer.length} bytes) to ${targetPath}`);
        return;
      }
    } catch (err) {
      console.warn(`Error reading ${key}:`, err);
    }
  }

  console.error("No valid backup found in Cloudflare R2 bucket.");
  process.exitCode = 1;
}

main();
