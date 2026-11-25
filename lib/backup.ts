import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, getDb, getDbPath } from "./db.ts";
import { isS3Configured, saveFile, getFile, getStorageConfig } from "./storage.ts";

export interface BackupCounts {
  users: number;
  items: number;
  disposals: number;
  wishlist: number;
  categories?: number;
}

export interface BackupStatus {
  configured: boolean;
  bucket: string | null;
  lastBackupTime: string | null;
  lastStatus: "idle" | "success" | "error";
  lastError: string | null;
  sqliteSize?: number;
  jsonSize?: number;
  counts?: BackupCounts;
}

export interface BackupResult {
  ok: boolean;
  timestamp?: string;
  sqliteKeys?: string[];
  jsonKeys?: string[];
  counts?: BackupCounts;
  sqliteSize?: number;
  jsonSize?: number;
  uploadedToCloud?: boolean;
  error?: string;
}

function getStatusFilePath(): string {
  const dir = DATA_DIR || path.join(process.cwd(), "data");
  return path.join(dir, "backup-status.json");
}

let cachedStatus: BackupStatus | null = null;

function readSavedStatus(): BackupStatus {
  if (cachedStatus) return cachedStatus;
  const config = getStorageConfig();
  const defaultStatus: BackupStatus = {
    configured: config.isConfigured,
    bucket: config.bucket,
    lastBackupTime: null,
    lastStatus: "idle",
    lastError: null,
  };

  const statusFile = getStatusFilePath();
  if (fs.existsSync(statusFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(statusFile, "utf8"));
      cachedStatus = {
        ...defaultStatus,
        ...parsed,
        configured: config.isConfigured,
        bucket: config.bucket,
      };
      return cachedStatus!;
    } catch {
      // ignore
    }
  }

  cachedStatus = defaultStatus;
  return cachedStatus;
}

function saveBackupStatus(status: BackupStatus): void {
  cachedStatus = status;
  try {
    const statusFile = getStatusFilePath();
    fs.mkdirSync(path.dirname(statusFile), { recursive: true });
    fs.writeFileSync(statusFile, JSON.stringify(status, null, 2), "utf8");
  } catch (err) {
    console.warn("[Backup] Failed to persist backup status:", err);
  }
}

export function getBackupStatus(): BackupStatus {
  const current = readSavedStatus();
  const config = getStorageConfig();
  return {
    ...current,
    configured: config.isConfigured,
    bucket: config.bucket,
  };
}

/**
 * Creates an atomic SQLite snapshot using VACUUM INTO and extracts
 * structured JSON data of all tables, uploading both to Cloudflare R2 / S3
 * and keeping a local safety snapshot.
 */
export async function performDatabaseBackup(): Promise<BackupResult> {
  const config = getStorageConfig();
  const db = getDb();
  const dbName = fs.existsSync(path.join(DATA_DIR, "declutter.db")) ? "declutter.db" : "smpl.db";

  const tempSnapshotPath = path.join(
    DATA_DIR,
    `temp-backup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.sqlite`
  );

  try {
    if (fs.existsSync(tempSnapshotPath)) {
      try {
        fs.unlinkSync(tempSnapshotPath);
      } catch {
        // ignore
      }
    }

    // 1. Consistent SQLite binary snapshot
    db.exec(`VACUUM INTO '${tempSnapshotPath}'`);
    const sqliteBuffer = fs.readFileSync(tempSnapshotPath);

    // 2. Structured JSON dump
    const users = db
      .prepare(
        `SELECT id, email, name, avatar_path, plan, subscription_interval,
                subscription_renews_at, is_bootstrap, created_at
         FROM users`
      )
      .all();
    const items = db.prepare("SELECT * FROM items").all();
    const disposals = db.prepare("SELECT * FROM disposals").all();
    const wishlist = db.prepare("SELECT * FROM wishlist_items").all();

    let userCategories: unknown[] = [];
    try {
      userCategories = db.prepare("SELECT * FROM user_categories").all();
    } catch {
      // table might not exist in early tests
    }

    let oauthAccounts: unknown[] = [];
    try {
      oauthAccounts = db
        .prepare("SELECT provider, provider_id, email, user_id, created_at FROM oauth_accounts")
        .all();
    } catch {
      // table might not exist in early tests
    }

    const counts: BackupCounts = {
      users: users.length,
      items: items.length,
      disposals: disposals.length,
      wishlist: wishlist.length,
      categories: userCategories.length,
    };

    const jsonExport = {
      version: 1,
      exportedAt: new Date().toISOString(),
      database: dbName,
      counts,
      data: {
        users,
        items,
        disposals,
        wishlist,
        categories: userCategories,
        oauthAccounts,
      },
    };

    const jsonBuffer = Buffer.from(JSON.stringify(jsonExport, null, 2), "utf8");

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const sqliteKeys = [
      "backups/smpl-latest.sqlite",
      "backups/declutter-latest.sqlite",
      `backups/smpl-${timestamp}.sqlite`,
    ];
    const jsonKeys = [
      "backups/smpl-latest.json",
      `backups/smpl-${timestamp}.json`,
    ];

    // Local snapshot copy as fallback / safety net
    try {
      const localBackupDir = path.join(DATA_DIR, "backups");
      fs.mkdirSync(localBackupDir, { recursive: true });
      fs.writeFileSync(path.join(localBackupDir, "smpl-latest.sqlite"), sqliteBuffer);
      fs.writeFileSync(path.join(localBackupDir, "smpl-latest.json"), jsonBuffer);
    } catch (localErr) {
      console.warn("[Backup] Failed to write local backup copy:", localErr);
    }

    let uploadedToCloud = false;
    if (config.isConfigured) {
      for (const key of sqliteKeys) {
        await saveFile({
          filename: key,
          buffer: sqliteBuffer,
          contentType: "application/vnd.sqlite3",
        });
      }
      for (const key of jsonKeys) {
        await saveFile({
          filename: key,
          buffer: jsonBuffer,
          contentType: "application/json",
        });
      }
      uploadedToCloud = true;
    }

    const newStatus: BackupStatus = {
      configured: config.isConfigured,
      bucket: config.bucket,
      lastBackupTime: new Date().toISOString(),
      lastStatus: "success",
      lastError: null,
      sqliteSize: sqliteBuffer.length,
      jsonSize: jsonBuffer.length,
      counts,
    };
    saveBackupStatus(newStatus);

    return {
      ok: true,
      timestamp: newStatus.lastBackupTime!,
      sqliteKeys,
      jsonKeys,
      counts,
      sqliteSize: sqliteBuffer.length,
      jsonSize: jsonBuffer.length,
      uploadedToCloud,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Backup] Database backup error:", errorMsg);

    const errorStatus: BackupStatus = {
      ...readSavedStatus(),
      configured: config.isConfigured,
      bucket: config.bucket,
      lastStatus: "error",
      lastError: errorMsg,
    };
    saveBackupStatus(errorStatus);

    return {
      ok: false,
      error: errorMsg,
    };
  } finally {
    if (fs.existsSync(tempSnapshotPath)) {
      try {
        fs.unlinkSync(tempSnapshotPath);
      } catch {
        // ignore
      }
    }
  }
}

let autoBackupTimer: NodeJS.Timeout | null = null;

/**
 * Schedules an asynchronous debounced automatic backup.
 * Safe to call frequently upon every mutation: rapid calls will collapse
 * into a single backup once the delay window passes.
 */
export function scheduleAutoBackup(delayMs = 5000): void {
  if (!isS3Configured) {
    return;
  }

  if (autoBackupTimer) {
    clearTimeout(autoBackupTimer);
  }

  autoBackupTimer = setTimeout(async () => {
    try {
      await performDatabaseBackup();
    } catch (err) {
      console.error("[AutoBackup] Scheduled auto-backup failed:", err);
    }
  }, delayMs);

  if (typeof autoBackupTimer.unref === "function") {
    autoBackupTimer.unref();
  }
}

/**
 * If the local database file does not exist (e.g. fresh container startup),
 * checks Cloudflare R2 / S3 for a latest SQLite backup and downloads it.
 */
export async function tryRestoreDatabaseFromStorage(): Promise<boolean> {
  const declutterExists = fs.existsSync(path.join(DATA_DIR, "declutter.db"));
  const smplExists = fs.existsSync(path.join(DATA_DIR, "smpl.db"));

  if (declutterExists || smplExists) {
    return false;
  }

  if (!isS3Configured) {
    return false;
  }

  console.log("[Restore] No local SQLite database found. Searching Cloudflare R2 for backups...");
  const candidates = ["backups/smpl-latest.sqlite", "backups/declutter-latest.sqlite"];

  for (const key of candidates) {
    try {
      const file = await getFile(key);
      if (file && file.buffer && file.buffer.length > 0) {
        const targetPath = path.join(DATA_DIR, "smpl.db");
        fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(targetPath, file.buffer);
        console.log(
          `[Restore] Restored database from ${key} (${file.buffer.length} bytes) to ${targetPath}`
        );
        return true;
      }
    } catch (err) {
      console.warn(`[Restore] Error checking ${key}:`, err);
    }
  }

  console.log("[Restore] No previous backup found in Cloudflare R2. Initializing new database.");
  return false;
}
