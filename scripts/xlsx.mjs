/**
 * A minimal, dependency-free XLSX reader.
 *
 * XLSX is a ZIP of XML parts. We only need one worksheet, so this reads:
 *   - xl/sharedStrings.xml      the shared string table
 *   - xl/worksheets/sheet1.xml  the first worksheet
 *
 * Everything is parsed with plain string handling — no npm packages, so the
 * importer runs anywhere Node does (including the Docker image).
 */
import fs from "node:fs";
import zlib from "node:zlib";

/* ------------------------------------------------------------------- zip */

/** Locate the End Of Central Directory record (the ZIP's index). */
function findEocd(buf) {
  const start = Math.max(0, buf.length - 0xffff - 22);
  for (let i = buf.length - 22; i >= start; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw new Error("Not a ZIP file: no end-of-central-directory record found.");
}

/** Read every entry of a ZIP archive into a Map<name, Buffer>. */
export function unzip(buf) {
  const eocd = findEocd(buf);
  const entryCount = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  const files = new Map();

  for (let i = 0; i < entryCount; i++) {
    if (buf.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("Corrupt ZIP: bad central directory signature.");
    }
    const method = buf.readUInt16LE(offset + 10);
    const compressedSize = buf.readUInt32LE(offset + 20);
    const nameLength = buf.readUInt16LE(offset + 28);
    const extraLength = buf.readUInt16LE(offset + 30);
    const commentLength = buf.readUInt16LE(offset + 32);
    const localOffset = buf.readUInt32LE(offset + 42);
    const name = buf.toString("utf8", offset + 46, offset + 46 + nameLength);
    offset += 46 + nameLength + extraLength + commentLength;

    if (buf.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error(`Corrupt ZIP: bad local header for ${name}.`);
    }
    const localNameLength = buf.readUInt16LE(localOffset + 26);
    const localExtraLength = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const raw = buf.subarray(dataStart, dataStart + compressedSize);
    files.set(name, method === 0 ? Buffer.from(raw) : zlib.inflateRawSync(raw));
  }
  return files;
}

/* ------------------------------------------------------------------ xml */

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeXml(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, code) => {
    if (code[0] === "#") {
      const value =
        code[1] === "x" || code[1] === "X"
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : match;
    }
    return ENTITIES[code] ?? match;
  });
}

/**
 * Find every `<tag ...>` element in document order.
 *
 * Handles both `<tag>...</tag>` and the self-closing `<tag .../>` form, which
 * Excel uses freely for empty cells — ignoring the self-closing form would
 * silently shift every later column.
 */
function elements(xml, tag) {
  const out = [];
  const open = new RegExp(`<${tag}(\\s[^>]*?)?(/)?>`, "g");
  let match;
  while ((match = open.exec(xml)) !== null) {
    const [full, , selfClosing] = match;
    const attrs = full;
    if (selfClosing) {
      out.push({ attrs, inner: "" });
      continue;
    }
    const end = xml.indexOf(`</${tag}>`, open.lastIndex);
    if (end === -1) break;
    out.push({ attrs, inner: xml.slice(open.lastIndex, end) });
    open.lastIndex = end + tag.length + 3;
  }
  return out;
}

/** Read an attribute out of a raw tag string. */
function attr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match ? decodeXml(match[1]) : null;
}

/** Column letters ("A", "BC") to a zero-based index. */
function columnIndex(letters) {
  let index = 0;
  for (const char of letters) index = index * 26 + (char.charCodeAt(0) - 64);
  return index - 1;
}

/* ----------------------------------------------------------------- xlsx */

/**
 * The name of the first worksheet, as recorded in xl/workbook.xml.
 *
 * TomsHQ names its export after the moment it was taken
 * ("2026-09-13T08_23_31.892ZTomsHQ-"), so the sheet name doubles as the
 * snapshot date for the data it holds.
 */
export function sheetNameOf(filePath) {
  const files = unzip(fs.readFileSync(filePath));
  const workbook = files.get("xl/workbook.xml");
  if (!workbook) return null;
  const sheets = elements(workbook.toString("utf8"), "sheet");
  if (sheets.length === 0) return null;
  return attr(sheets[0].attrs, "name");
}

/**
 * Read the first worksheet of an XLSX file.
 *
 * Returns { headers: string[], rows: Array<Record<string, string | number | null>> }.
 * Rows that are entirely empty are skipped; the AutoFilter state of the
 * workbook is deliberately ignored so hidden-but-real rows are read too.
 */
export function readFirstSheet(filePath) {
  const files = unzip(fs.readFileSync(filePath));

  const shared = [];
  const sharedPart = files.get("xl/sharedStrings.xml");
  if (sharedPart) {
    for (const si of elements(sharedPart.toString("utf8"), "si")) {
      // A shared string may be split across several <t> runs (rich text).
      let text = "";
      for (const t of elements(si.inner, "t")) {
        text += decodeXml(t.inner.replace(/<[^>]*>/g, ""));
      }
      shared.push(text);
    }
  }

  const sheetName =
    [...files.keys()].find((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)) ??
    [...files.keys()].find((n) => n.startsWith("xl/worksheets/") && n.endsWith(".xml"));
  if (!sheetName) throw new Error("No worksheet found in the workbook.");

  const sheet = files.get(sheetName).toString("utf8");
  const rows = [];

  for (const row of elements(sheet, "row")) {
    const cells = [];
    let cursor = 0;
    for (const cell of elements(row.inner, "c")) {
      const reference = attr(cell.attrs, "r");
      const type = attr(cell.attrs, "t");
      const index = reference ? columnIndex(reference.replace(/\d+/g, "")) : cursor;

      let value = null;
      if (type === "inlineStr") {
        const is = elements(cell.inner, "is")[0];
        value = is ? decodeXml(is.inner.replace(/<[^>]*>/g, "")) : "";
      } else {
        const v = elements(cell.inner, "v")[0];
        const raw = v ? decodeXml(v.inner) : null;
        if (raw === null || raw === "") {
          value = null;
        } else if (type === "s") {
          value = shared[Number(raw)] ?? "";
        } else if (type === "str" || type === "e") {
          value = raw;
        } else {
          const num = Number(raw);
          value = Number.isFinite(num) ? num : raw;
        }
      }
      cells[index] = value;
      cursor = index + 1;
    }

    for (let i = cells.length - 1; i >= 0; i--) {
      if (cells[i] === undefined) cells[i] = null;
    }
    if (cells.every((c) => c === null || c === "")) continue;
    rows.push(cells);
  }

  const headerRow = rows.shift() ?? [];
  const headers = headerRow.map((h) => (h === null ? "" : String(h).trim()));
  const records = rows.map((cells) => {
    const record = {};
    headers.forEach((header, i) => {
      if (!header) return;
      record[header] = cells[i] ?? null;
    });
    return record;
  });

  return { headers, rows: records };
}
