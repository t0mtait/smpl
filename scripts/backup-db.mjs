/**
 * Off-site SQLite backup utility.
 * Backs up the SQLite database to S3 / Cloudflare R2 if configured.
 * Can be run manually or as a cron / pre-shutdown task.
 */
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, getDb } from "../lib/db.ts";
import { isS3Configured, saveFile } from "../lib/storage.ts";

async function backup() {
  console.log("Starting SQLite backup check...");
  if (!isS3Configured) {
    console.log("S3/R2 storage is not configured (missing environment variables). Skipping off-site cloud backup.");
    return;
  }

  const db = getDb();
  const dbName = fs.existsSync(path.join(DATA_DIR, "declutter.db")) ? "declutter.db" : "smpl.db";
  const backupLocalPath = path.join(DATA_DIR, `${dbName}.backup`);

  try {
    // Perform safe SQLite VACUUM INTO snapshot
    if (fs.existsSync(backupLocalPath)) {
      fs.unlinkSync(backupLocalPath);
    }
    console.log(`Creating consistent SQLite snapshot at ${backupLocalPath}...`);
    db.exec(`VACUUM INTO '${backupLocalPath}'`);

    const fileBuffer = fs.readFileSync(backupLocalPath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const cloudFilename = `backups/${dbName}-${timestamp}.sqlite`;
    const latestFilename = `backups/${dbName}-latest.sqlite`;

    console.log(`Uploading snapshot to ${cloudFilename} and ${latestFilename}...`);
    await saveFile({
      filename: cloudFilename,
      buffer: fileBuffer,
      contentType: "application/vnd.sqlite3",
    });

    await saveFile({
      filename: latestFilename,
      buffer: fileBuffer,
      contentType: "application/vnd.sqlite3",
    });

    console.log("Backup completed successfully!");
  } catch (err) {
    console.error("Backup failed:", err);
    process.exitCode = 1;
  } finally {
    if (fs.existsSync(backupLocalPath)) {
      try {
        fs.unlinkSync(backupLocalPath);
      } catch {
        // ignore
      }
    }
  }
}

backup();
