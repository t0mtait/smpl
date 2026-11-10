/**
 * Scoring engine tests. Plain node + tsc, no test framework.
 *
 *   npm test
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, ".test-build");

fs.rmSync(OUT, { recursive: true, force: true });

const tsc = spawnSync(
  "npx",
  ["tsc", "tests/scoring.test.ts", "lib/scoring.ts", "lib/db.ts", "--outDir", OUT, "--module", "commonjs", "--target", "es2022", "--moduleResolution", "node", "--esModuleInterop", "--skipLibCheck", "--types", "node"],
  { cwd: ROOT, encoding: "utf8" }
);

if (tsc.status !== 0) {
  console.error(tsc.stdout || tsc.stderr);
  process.exit(1);
}

const run = spawnSync("node", [path.join(OUT, "tests", "scoring.test.js")], { cwd: ROOT, encoding: "utf8" });
process.stdout.write(run.stdout || "");
process.stderr.write(run.stderr || "");
process.exit(run.status ?? 1);
