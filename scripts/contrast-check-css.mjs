#!/usr/bin/env node
/**
 * Contrast check that reads the palette out of the CSS that ships.
 *
 *   node scripts/contrast-check-css.mjs <globals.css> [pairs.json]
 *   node scripts/contrast-check-css.mjs app/globals.css templates/contrast-pairs.json
 *
 * Why this exists alongside scripts/contrast-check.mjs:
 *
 * A contrast pass taken against a *copy* of the palette proves nothing
 * about the app. The copy drifts the moment a value is retuned in the
 * CSS, and the checker keeps reporting the old numbers — so the check
 * passes while the shipped colours fail. The pairs are worth authoring
 * by hand; the colour *values* are not. This script parses the
 * `--c-<token>` declarations out of `:root` and `.dark` and measures
 * exactly those, so there is no second copy to drift.
 *
 * Token values may be written either way:
 *
 *   --c-paper: 246 244 239;     (space-separated RGB triplet)
 *   --c-paper: #f6f4ef;         (hex)
 *
 * Pairs file: JSON with a "pairs" array, the same shape as
 * templates/contrast-spec.json:
 *
 *   { "pairs": [ { "fg": "ink", "bg": "paper", "min": 7, "label": "..." } ] }
 *
 * A full contrast-spec.json also works; only its "pairs" array is read,
 * because the modes come from the CSS.
 *
 * Thresholds: body text 7, secondary/status text 4.5, icons and
 * non-text graphics 3.
 *
 * Beyond the ratio it reports:
 *   - a token named in a pair but missing from a mode;
 *   - a token defined in one mode but not the other (a light-only token
 *     keeps its light value in dark mode — a light-on-light panel that
 *     passes every build gate and fails every contrast check).
 *
 * Exits non-zero on any failure, so it can gate a build.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/* ------------------------------------------------------------------ args */

const argv = process.argv.slice(2);
const flags = {};
const positional = [];
for (const arg of argv) {
  if (arg.startsWith("--")) {
    const eq = arg.indexOf("=");
    if (eq === -1) flags[arg.slice(2)] = "true";
    else flags[arg.slice(2, eq)] = arg.slice(eq + 1);
  } else {
    positional.push(arg);
  }
}

const cssPath = positional[0];
if (!cssPath) {
  console.error(
    "usage: node scripts/contrast-check-css.mjs <globals.css> [pairs.json]"
  );
  process.exit(2);
}

const pairsPath =
  positional[1] ?? path.join(HERE, "..", "templates", "contrast-pairs.json");

const lightSelector = flags["light-selector"] ?? ":root";
const darkSelector = flags["dark-selector"] ?? ".dark";
/** Token variables are `--c-<name>`; strip the `c-` to get `<name>`. */
const varPrefix = flags.prefix ?? "c-";

/* ------------------------------------------------------------ css parsing */

/** Strip CSS comments so a selector mentioned in prose is not matched. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * The body of the CSS rule whose selector matches `selector`.
 *
 * Comments are stripped first, and the selector must be followed by `{`,
 * so a prose mention of `.dark` cannot be mistaken for the rule.
 */
function cssBlock(src, selector) {
  const clean = stripComments(src);
  let from = 0;
  for (;;) {
    const idx = clean.indexOf(selector, from);
    if (idx === -1) return null;
    from = idx + selector.length;

    let i = from;
    while (i < clean.length && /\s/.test(clean[i])) i++;
    if (clean[i] !== "{") continue;

    // Reject a hit inside a longer compound token (.dark-mode, #dark).
    const prev = clean[idx - 1];
    if (prev === "-" || prev === "_" || prev === "." || prev === "#" || prev === "&") {
      continue;
    }

    let depth = 0;
    for (let j = i; j < clean.length; j++) {
      if (clean[j] === "{") depth++;
      else if (clean[j] === "}") {
        depth--;
        if (depth === 0) return clean.slice(i + 1, j);
      }
    }
    return null;
  }
}

/** Parse "#rrggbb", "#rgb" or an "R G B" triplet into [r, g, b]. */
function toRgb(raw) {
  const value = raw.trim();
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    if (hex.length === 3) {
      return [0, 1, 2].map((i) => parseInt(hex[i] + hex[i], 16));
    }
    if (hex.length === 6) {
      return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    }
    return null;
  }
  const parts = value.split(/[\s,]+/).filter(Boolean);
  if (parts.length === 3 && parts.every((p) => /^\d+$/.test(p))) {
    return parts.map(Number);
  }
  return null;
}

/** Token name -> [r, g, b] for one CSS block. */
function tokensIn(block) {
  const out = new Map();
  if (!block) return out;
  for (const m of block.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    const name = m[1];
    if (varPrefix && !name.startsWith(varPrefix)) continue;
    const rgb = toRgb(m[2]);
    if (!rgb) continue;
    out.set(name.slice(varPrefix.length), rgb);
  }
  return out;
}

/* ------------------------------------------------------------- colour math */

function relative(r, g, b) {
  const lin = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrast(a, b) {
  const la = relative(...a);
  const lb = relative(...b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/* -------------------------------------------------------------------- run */

let cssSrc;
try {
  cssSrc = fs.readFileSync(cssPath, "utf8");
} catch (err) {
  console.error(`Cannot read CSS ${cssPath}: ${err.message}`);
  process.exit(2);
}

const lightBlock = cssBlock(cssSrc, lightSelector);
const darkBlock = cssBlock(cssSrc, darkSelector);

if (!lightBlock) {
  console.error(`${cssPath} has no "${lightSelector}" block.`);
  process.exit(2);
}
if (!darkBlock) {
  console.error(
    `${cssPath} has no "${darkSelector}" block — dark mode values cannot be verified.`
  );
  process.exit(2);
}

const modes = {
  light: tokensIn(lightBlock),
  dark: tokensIn(darkBlock),
};

let pairsDoc;
try {
  pairsDoc = JSON.parse(fs.readFileSync(pairsPath, "utf8"));
} catch (err) {
  console.error(`Cannot read pairs file ${pairsPath}: ${err.message}`);
  process.exit(2);
}

const pairs = pairsDoc.pairs ?? [];
if (!Array.isArray(pairs) || pairs.length === 0) {
  console.error(`${pairsPath} has no "pairs" array.`);
  process.exit(2);
}

let failures = 0;
let missing = 0;

console.log(`css:    ${cssPath}`);
console.log(`pairs:  ${pairsPath}`);
console.log(
  `tokens: ${modes.light.size} in "${lightSelector}", ${modes.dark.size} in "${darkSelector}"`
);

for (const [modeName, palette] of Object.entries(modes)) {
  console.log(`\n===== ${modeName.toUpperCase()} =====`);

  for (const pair of pairs) {
    const { fg, bg } = pair;
    const min = pair.min ?? 4.5;
    const label = pair.label ?? `${fg} on ${bg}`;

    if (!palette.has(fg) || !palette.has(bg)) {
      missing++;
      const which = !palette.has(fg) ? fg : bg;
      console.log(`MISS  ${which} is not defined in ${modeName} — ${label}`);
      continue;
    }

    const ratio = contrast(palette.get(fg), palette.get(bg));
    const ok = ratio >= min;
    if (!ok) failures++;
    console.log(
      `${ok ? "  ok  " : "FAIL  "} ${ratio.toFixed(2).padStart(6)} (min ${min})  ` +
        `${fg} on ${bg} — ${label}`
    );
  }
}

/* Mode asymmetry: a token in one mode but not the other. */
const asymmetries = [];
for (const [name] of modes.light) {
  if (!modes.dark.has(name)) asymmetries.push(`${name} — light only`);
}
for (const [name] of modes.dark) {
  if (!modes.light.has(name)) asymmetries.push(`${name} — dark only`);
}
if (asymmetries.length) {
  console.log("\n===== MODE ASYMMETRY =====");
  for (const a of asymmetries) console.log(`  ${a}`);
  console.log(
    "  A token defined in one mode only keeps its value in the other mode."
  );
  failures += asymmetries.length;
}

/* ----------------------------------------------------------------- summary */

const summary = [];
if (failures) summary.push(`${failures} FAILING PAIR(S)`);
if (missing) summary.push(`${missing} PAIR(S) WITH A TOKEN MISSING IN A MODE`);
console.log(
  summary.length
    ? `\n${summary.join(" · ")}`
    : `\nAll ${pairs.length * Object.keys(modes).length} pairs pass.`
);

process.exit(failures || missing ? 1 : 0);
