/**
 * Test runner. Plain node + tsc, no test framework.
 *
 *   npm test
 *
 * Two suites:
 *   tests/scoring.test.ts  — the declutter scoring engine
 *   tests/auth.test.ts     — password hashing, sessions, ownership isolation
 *
 * The auth suite runs against a throwaway database in a temp directory, so
 * it never touches the real data/ folder. DECLUTTER_DATA_DIR is set here
 * (in the child process env) so lib/db.ts picks it up at import time.
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
    "lib/scoring.ts",
    "lib/db.ts",
    "lib/password.ts",
    "--outDir", OUT,
    "--module", "commonjs",
    "--target", "es2022",
    "--moduleResolution", "node",
    "--esModuleInterop",
    "--skipLibCheck",
    "--types", "node",
  ],
  { cwd: ROOT, encoding: "utf8" }
);

if (tsc.status !== 0) {
  console.error(tsc.stdout || tsc.stderr);
  process.exit(1);
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "declutter-test-"));
let failed = false;

for (const suite of ["scoring", "auth"]) {
  console.log(`\n── ${suite} ──`);
  const run = spawnSync("node", [path.join(OUT, "tests", `${suite}.test.js`)], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, DECLUTTER_DATA_DIR: TMP },
  });
  process.stdout.write(run.stdout || "");
  process.stderr.write(run.stderr || "");
  if (run.status !== 0) failed = true;
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
