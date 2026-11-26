import { NextResponse } from "next/server";
import { listItems, listUserCategories, listWishlist } from "@/lib/db";
import { apiUser } from "@/lib/auth";
import { formatCategory, formatQuarter } from "@/lib/format";
import { createZip } from "@/lib/zip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toCsvCell(val: unknown): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [
    headers.map(toCsvCell).join(","),
    ...rows.map((row) => row.map(toCsvCell).join(",")),
  ];
  return lines.join("\r\n");
}

export async function GET(req: Request) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // Export is paywalled: Pro members only
  if (user.plan !== "premium") {
    return NextResponse.json(
      { error: "Exporting data to CSV and JSON is a Pro feature. Please upgrade to Pro to download your data." },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const format = url.searchParams.get("format");
  const dateStr = new Date().toISOString().slice(0, 10);

  const allItems = listItems(user.id);
  const wishlistItems = listWishlist(user.id);
  const userCategories = listUserCategories(user.id);

  // Builders for individual data representations
  const buildJson = () =>
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        user: { name: user.name, email: user.email },
        items: allItems,
        wishlist: wishlistItems,
        categories: userCategories,
      },
      null,
      2
    );

  const buildInventoryCsv = () => {
    const owned = allItems.filter((i) => i.status === "owned");
    const headers = [
      "ID",
      "Name",
      "Brand",
      "Category",
      "Subcategory",
      "Quality",
      "Status",
      "Current Value",
      "Purchase Price",
      "Acquired",
      "Offloaded",
      "Usage Frequency",
      "Location",
      "Notes",
    ];
    const rows = owned.map((i) => [
      i.id,
      i.name,
      i.brand || "",
      formatCategory(i.category),
      i.subcategory || "",
      i.quality || "",
      i.status,
      i.currentValue != null ? i.currentValue : "",
      i.purchasePrice != null ? i.purchasePrice : "",
      formatQuarter(i.purchaseDate),
      formatQuarter(i.offloadedDate),
      i.useFrequency,
      i.location || "",
      i.description || "",
    ]);
    return toCsv(headers, rows);
  };

  const buildPurgatoryCsv = () => {
    const purgatory = allItems.filter((i) => i.status === "purgatory");
    const headers = [
      "ID",
      "Name",
      "Brand",
      "Category",
      "Subcategory",
      "Quality",
      "Status",
      "Estimated Value",
      "Purchase Price",
      "Acquired",
      "Location",
      "Notes",
    ];
    const rows = purgatory.map((i) => [
      i.id,
      i.name,
      i.brand || "",
      formatCategory(i.category),
      i.subcategory || "",
      i.quality || "",
      i.status,
      i.currentValue != null ? i.currentValue : "",
      i.purchasePrice != null ? i.purchasePrice : "",
      formatQuarter(i.purchaseDate),
      i.location || "",
      i.description || "",
    ]);
    return toCsv(headers, rows);
  };

  const buildWishlistCsv = () => {
    const headers = [
      "ID",
      "Name",
      "Category",
      "Priority",
      "Price",
      "URL",
      "Notes",
    ];
    const rows = wishlistItems.map((w) => [
      w.id,
      w.name,
      formatCategory(w.category),
      w.priority,
      w.price != null ? w.price : "",
      w.url || "",
      w.notes || "",
    ]);
    return toCsv(headers, rows);
  };

  const buildOffloadedCsv = () => {
    const offloaded = allItems.filter((i) =>
      ["sold", "donated", "disposed", "closed"].includes(i.status)
    );
    const headers = [
      "ID",
      "Name",
      "Brand",
      "Category",
      "Subcategory",
      "Quality",
      "Status",
      "Return Amount",
      "Acquired",
      "Offloaded",
      "Location",
      "Notes",
    ];
    const rows = offloaded.map((i) => [
      i.id,
      i.name,
      i.brand || "",
      formatCategory(i.category),
      i.subcategory || "",
      i.quality || "",
      i.status,
      i.currentValue != null ? i.currentValue : "",
      formatQuarter(i.purchaseDate),
      formatQuarter(i.offloadedDate),
      i.location || "",
      i.description || "",
    ]);
    return toCsv(headers, rows);
  };

  const buildAllItemsCsv = () => {
    const headers = [
      "ID",
      "Name",
      "Brand",
      "Category",
      "Subcategory",
      "Quality",
      "Status",
      "Value",
      "Purchase Price",
      "Acquired",
      "Offloaded",
      "Frequency",
      "Location",
      "Notes",
    ];
    const rows = allItems.map((i) => [
      i.id,
      i.name,
      i.brand || "",
      formatCategory(i.category),
      i.subcategory || "",
      i.quality || "",
      i.status,
      i.currentValue != null ? i.currentValue : "",
      i.purchasePrice != null ? i.purchasePrice : "",
      formatQuarter(i.purchaseDate),
      formatQuarter(i.offloadedDate),
      i.useFrequency,
      i.location || "",
      i.description || "",
    ]);
    return toCsv(headers, rows);
  };

  // If specific single-file download is explicitly requested
  if (type === "json" || format === "json") {
    return new NextResponse(buildJson(), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="smpl-backup-${dateStr}.json"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (type === "inventory") {
    return new NextResponse(buildInventoryCsv(), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="smpl-inventory-${dateStr}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (type === "purgatory") {
    return new NextResponse(buildPurgatoryCsv(), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="smpl-purgatory-${dateStr}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (type === "wishlist") {
    return new NextResponse(buildWishlistCsv(), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="smpl-wishlist-${dateStr}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (type === "offloaded") {
    return new NextResponse(buildOffloadedCsv(), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="smpl-offloaded-${dateStr}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (type === "all-items") {
    return new NextResponse(buildAllItemsCsv(), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="smpl-all-items-${dateStr}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // Default: download zip archive containing all CSVs and JSON inside a folder
  const folder = `smpl-export-${dateStr}`;
  const zipBuffer = createZip([
    { name: `${folder}/inventory.csv`, data: buildInventoryCsv() },
    { name: `${folder}/purgatory.csv`, data: buildPurgatoryCsv() },
    { name: `${folder}/offloaded.csv`, data: buildOffloadedCsv() },
    { name: `${folder}/wishlist.csv`, data: buildWishlistCsv() },
    { name: `${folder}/all-items.csv`, data: buildAllItemsCsv() },
    { name: `${folder}/backup.json`, data: buildJson() },
  ]);

  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="smpl-export-${dateStr}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
