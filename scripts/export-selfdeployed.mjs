/**
 * Export and prepare the database and uploaded photos from the self-deployed instance
 * so they can be uploaded directly to Railway volume storage.
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const SOURCE_DIR = "/opt/stacks/smpl/data";
const TARGET_DIR = path.join(process.cwd(), "data");

function exportDatabase() {
  console.log("Preparing self-deployed database export...");
  const sourceDbPath = path.join(SOURCE_DIR, "declutter.db");
  const targetDbPath = path.join(TARGET_DIR, "declutter.db");

  if (!fs.existsSync(sourceDbPath)) {
    console.error(`Source database not found at ${sourceDbPath}`);
    process.exit(1);
  }

  // Ensure target directories exist
  fs.mkdirSync(TARGET_DIR, { recursive: true });
  fs.mkdirSync(path.join(TARGET_DIR, "uploads"), { recursive: true });

  const tempExportPath = path.join(TARGET_DIR, "export-temp.sqlite");
  if (fs.existsSync(tempExportPath)) fs.unlinkSync(tempExportPath);

  // Safe VACUUM INTO to checkpoint WAL writes into a clean single-file SQLite database
  const db = new DatabaseSync(sourceDbPath);
  console.log("Creating consistent snapshot from live database...");
  db.exec(`VACUUM INTO '${tempExportPath}'`);

  // Move temp export to target declutter.db
  if (fs.existsSync(targetDbPath)) {
    fs.copyFileSync(targetDbPath, path.join(TARGET_DIR, "declutter.db.bak"));
  }
  fs.copyFileSync(tempExportPath, targetDbPath);
  fs.unlinkSync(tempExportPath);

  // Verify export
  const exportedDb = new DatabaseSync(targetDbPath);
  const userCount = exportedDb.prepare("SELECT COUNT(*) as c FROM users").get();
  const itemCount = exportedDb.prepare("SELECT COUNT(*) as c FROM items").get();
  console.log(`Database exported successfully to ${targetDbPath}`);
  console.log(`- Users: ${userCount.c}`);
  console.log(`- Items: ${itemCount.c}`);

  // Copy uploads if any
  const sourceUploads = path.join(SOURCE_DIR, "uploads");
  const targetUploads = path.join(TARGET_DIR, "uploads");
  if (fs.existsSync(sourceUploads)) {
    const files = fs.readdirSync(sourceUploads);
    let copied = 0;
    for (const f of files) {
      const srcFile = path.join(sourceUploads, f);
      const dstFile = path.join(targetUploads, f);
      if (fs.statSync(srcFile).isFile()) {
        fs.copyFileSync(srcFile, dstFile);
        copied++;
      }
    }
    console.log(`- Copied ${copied} uploaded photo(s) to ${targetUploads}`);
  }

  console.log("\nDone! To upload your database to Railway:");
  console.log("  1. In Railway Web UI -> Your Service -> Volume (/app/data) -> File Browser -> Upload 'data/declutter.db'");
  console.log("  OR via CLI:");
  console.log("  npx @railway/cli login");
  console.log("  npx @railway/cli volume files upload data/declutter.db /declutter.db");
}

exportDatabase();
