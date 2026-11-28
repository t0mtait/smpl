/**
 * Test runner. Plain node + tsc, no test framework.
 *
 *   npm test
 *
 * Three suites:
 *   tests/scoring.test.ts  — the declutter scoring engine
 *   tests/auth.test.ts     — password hashing, sessions, ownership isolation
 *   tests/money.test.ts    — null-vs-zero money, and the "closed" terminal state
 *   tests/dates.test.ts    — calendar dates stay calendar dates across timezones
 *   tests/sort.test.ts     — the inventory table's sort and filter helpers
 *   tests/import.test.mjs  — the workbook -> app mapping and the import write
 *
 * The suites that touch a database run against a throwaway database in a
 * temp directory, so they never touch the real data/ folder.
 * DECLUTTER_DATA_DIR is set here (in the child process env) so lib/db.ts
 * picks it up at import time.
 *
 * The import suite is plain ESM rather than TypeScript: it imports the
 * mapping module and the importer directly, including their .ts and .mjs
 * sources, which the CommonJS test build cannot express. Node strips the
 * types at runtime.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, ".test-build");

fs.rmSync(OUT, { recursive: true, force: true });

const tsc = spawnSync(
  "npx",
  [
    "tsc",
    "tests/scoring.test.ts",
    "tests/auth.test.ts",
    "tests/money.test.ts",
    "tests/dates.test.ts",
    "tests/sort.test.ts",
    "tests/stats.test.ts",
    "tests/backup.test.ts",
    "tests/lifecycle.test.ts",
    "tests/features.test.ts",
    "tests/permissions.test.ts",
    "tests/keyboard.test.ts",
    "lib/scoring.ts",
    "lib/db.ts",
    "lib/password.ts",
    "lib/stats.ts",
    "lib/format.ts",
    "lib/dates.ts",
    "lib/sort.ts",
    "lib/backup.ts",
    "lib/storage.ts",
    "lib/image-compression.ts",
    "lib/zip.ts",
    "lib/keyboard.ts",
    "--outDir",
    OUT,
    "--module",
    "commonjs",
    "--target",
    "es2022",
    "--moduleResolution",
    "node",
    "--rewriteRelativeImportExtensions",
    "--esModuleInterop",
    "--skipLibCheck",
    "--types",
    "node",
  ],
  { cwd: ROOT, encoding: "utf8" }
);

if (tsc.status !== 0) {
  console.error(tsc.stdout || tsc.stderr);
  process.exit(1);
}

let failed = false;

/** Run one suite in its own throwaway database directory. */
function runSuite(name, args) {
  console.log(`\n── ${name} ──`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `smpl-${name}-`));
  const run = spawnSync("node", args, {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, SMPL_DATA_DIR: tmp, DECLUTTER_DATA_DIR: tmp },
  });
  process.stdout.write(run.stdout || "");
  process.stderr.write(run.stderr || "");
  if (run.status !== 0) failed = true;
  fs.rmSync(tmp, { recursive: true, force: true });
}

runSuite("scoring", [path.join(OUT, "tests", "scoring.test.js")]);
runSuite("auth", [path.join(OUT, "tests", "auth.test.js")]);
runSuite("money", [path.join(OUT, "tests", "money.test.js")]);
runSuite("dates", [path.join(OUT, "tests", "dates.test.js")]);
runSuite("sort", [path.join(OUT, "tests", "sort.test.js")]);
runSuite("stats", [path.join(OUT, "tests", "stats.test.js")]);
runSuite("backup", [path.join(OUT, "tests", "backup.test.js")]);
runSuite("lifecycle", [path.join(OUT, "tests", "lifecycle.test.js")]);
runSuite("features", [path.join(OUT, "tests", "features.test.js")]);
runSuite("permissions", [path.join(OUT, "tests", "permissions.test.js")]);
runSuite("keyboard", [path.join(OUT, "tests", "keyboard.test.js")]);
runSuite("import", [path.join(ROOT, "tests", "import.test.mjs")]);

fs.rmSync(OUT, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
