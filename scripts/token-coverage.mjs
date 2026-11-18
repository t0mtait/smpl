#!/usr/bin/env node
/**
 * Token coverage check: tailwind.config.ts <-> globals.css.
 *
 *   node scripts/token-coverage.mjs [project-root]
 *
 * Default root is the current working directory. Expects
 * `tailwind.config.ts` and `app/globals.css` (or `styles/globals.css`).
 *
 * Three failure modes, all of which are silent:
 *
 * 1. A token referenced in the Tailwind colour map but never defined in
 *    CSS. The utility resolves to `rgb(var(--c-missing) / <alpha-value>)`,
 *    the browser drops the declaration, and the element renders with no
 *    colour at all.
 *
 * 2. A token defined for light mode but not for dark mode. It keeps its
 *    light value in dark mode — a light-on-light panel that passes every
 *    build gate and fails every contrast check.
 *
 * 3. A token defined in CSS but absent from the Tailwind map. Dead weight:
 *    the variable exists but no utility can reach it.
 *
 * This check is what makes a token migration safe to land in pieces. The
 * Tailwind config and the CSS must move together, and this script proves
 * they did.
 *
 * Exits non-zero on any missing or orphaned token.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.argv[2] ?? process.cwd());

function findFile(candidates) {
  for (const c of candidates) {
    const p = path.join(ROOT, c);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const configPath = findFile([
  "tailwind.config.ts",
  "tailwind.config.js",
  "tailwind.config.mjs",
  "tailwind.config.cjs",
]);
const cssPath = findFile([
  "app/globals.css",
  "styles/globals.css",
  "src/app/globals.css",
  "src/styles/globals.css",
]);

if (!configPath || !cssPath) {
  console.error(
    `Could not find both a Tailwind config and a globals.css under ${ROOT}.`
  );
  process.exit(2);
}

/** Tokens the config exposes to Tailwind. */
function configTokens(src) {
  const tokens = new Set();
  // Matches the usual helper: v("token") -> `rgb(var(--c-token) / <alpha-value>)`
  for (const m of src.matchAll(/v\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    tokens.add(m[1]);
  }
  // Also catch a literal rgb(var(--c-token) / <alpha-value>) written inline.
  for (const m of src.matchAll(/var\(\s*--c-([a-z0-9-]+)\s*\)/gi)) {
    tokens.add(m[1]);
  }
  return tokens;
}

/**
 * Strip CSS comments so a selector named in prose is not matched.
 *
 * A token stylesheet's header comment routinely explains the design
 * ("the light values live on :root; the dark values live on .dark").
 * Matching the selector without stripping comments finds that prose
 * first, so both lookups land on the same place and the light and dark
 * blocks come out identical.
 */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Extract the body of a CSS rule whose selector matches `selector`.
 *
 * The selector must be followed by `{`, so `.dark` does not match
 * `.dark-mode` or `#dark`.
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

/** Custom properties declared inside a CSS block body. */
function declaredVars(block) {
  const vars = new Set();
  if (!block) return vars;
  for (const m of block.matchAll(/--([a-z0-9-]+)\s*:/gi)) {
    vars.add(m[1]);
  }
  return vars;
}

const configSrc = fs.readFileSync(configPath, "utf8");
const cssSrc = fs.readFileSync(cssPath, "utf8");

const tokens = configTokens(configSrc);
const rootBlock = cssBlock(cssSrc, ":root");
const darkBlock = cssBlock(cssSrc, ".dark");

// The two blocks must be genuinely different. If they resolve to the
// same text, the selector lookup matched prose rather than rules, and
// every "missing in dark mode" result below would be vacuously empty.
if (rootBlock !== null && darkBlock !== null && rootBlock === darkBlock) {
  console.error(
    `${cssPath}: the ":root" and ".dark" rules resolved to the same block — ` +
      "the selector lookup matched a comment, not the rules. The dark-mode " +
      "check below would silently pass."
  );
  process.exit(2);
}

if (!rootBlock) {
  console.error(`${cssPath} has no :root block — cannot verify tokens.`);
  process.exit(2);
}
if (!darkBlock) {
  console.error(
    `${cssPath} has no .dark block — dark mode tokens cannot be verified.`
  );
  process.exit(2);
}

const rootVars = declaredVars(rootBlock);
const darkVars = declaredVars(darkBlock);

// Only compare the --c-* namespace; other custom properties (fonts, etc.)
// are not tokens.
const isToken = (name) => name.startsWith("c-");
const rootTokens = new Set([...rootVars].filter(isToken).map((n) => n.slice(2)));
const darkTokens = new Set([...darkVars].filter(isToken).map((n) => n.slice(2)));

const problems = [];

for (const t of [...tokens].sort()) {
  if (!rootTokens.has(t)) {
    problems.push(`MISSING IN CSS   --c-${t} is used by the Tailwind map but not declared on :root`);
  }
  if (!darkTokens.has(t)) {
    problems.push(`MISSING IN DARK  --c-${t} is declared for light mode but has no .dark value`);
  }
}

for (const t of [...rootTokens].sort()) {
  if (!tokens.has(t)) {
    problems.push(`ORPHANED         --c-${t} is declared in CSS but no Tailwind utility can reach it`);
  }
}

console.log(`config: ${path.relative(ROOT, configPath)}`);
console.log(`css:    ${path.relative(ROOT, cssPath)}`);
console.log(
  `tokens: ${tokens.size} in the Tailwind map, ` +
    `${rootTokens.size} on :root, ${darkTokens.size} in .dark`
);

if (problems.length === 0) {
  console.log("\nToken coverage OK — every token is defined in both modes and reachable.");
  process.exit(0);
}

console.log("");
for (const p of problems) console.log(p);
console.log(`\n${problems.length} problem(s).`);
process.exit(1);
