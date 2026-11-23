import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import {
  listUserCategories,
  addUserCategory,
  renameUserCategory,
  deleteUserCategory,
  addUserSubcategory,
  renameUserSubcategory,
  deleteUserSubcategory,
} from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const categories = listUserCategories(user.id);
  return NextResponse.json({ categories });
}

export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = String(body.action || "");
  const category = String(body.category || "").trim();
  const subcategory = String(body.subcategory || "").trim();
  const oldCategory = String(body.oldCategory || "").trim();
  const newCategory = String(body.newCategory || "").trim();
  const oldSubcategory = String(body.oldSubcategory || "").trim();
  const newSubcategory = String(body.newSubcategory || "").trim();

  switch (action) {
    case "add_category": {
      if (!category) return NextResponse.json({ error: "Category name required" }, { status: 400 });
      if (user.plan === "free") {
        const existing = listUserCategories(user.id);
        if (existing.length >= 5) {
          return NextResponse.json(
            { error: "Free plan is limited to 5 categories. Upgrade to Pro for unlimited categories." },
            { status: 403 }
          );
        }
      }
      addUserCategory(user.id, category);
      break;
    }
    case "rename_category": {
      if (!oldCategory || !newCategory) {
        return NextResponse.json({ error: "Both old and new category names required" }, { status: 400 });
      }
      renameUserCategory(user.id, oldCategory, newCategory);
      break;
    }
    case "delete_category": {
      if (!category) return NextResponse.json({ error: "Category name required" }, { status: 400 });
      deleteUserCategory(user.id, category);
      break;
    }
    case "add_subcategory": {
      if (!category || !subcategory) {
        return NextResponse.json({ error: "Category and subcategory required" }, { status: 400 });
      }
      if (user.plan === "free") {
        const existing = listUserCategories(user.id);
        const catItem = existing.find((c) => c.category.toLowerCase() === category.toLowerCase());
        if (catItem && catItem.subcategories.length >= 2) {
          return NextResponse.json(
            { error: "Free plan is limited to 2 subcategories per category. Upgrade to Pro for unlimited subcategories." },
            { status: 403 }
          );
        }
      }
      addUserSubcategory(user.id, category, subcategory);
      break;
    }
    case "rename_subcategory": {
      if (!category || !oldSubcategory || !newSubcategory) {
        return NextResponse.json(
          { error: "Category, old and new subcategory names required" },
          { status: 400 }
        );
      }
      renameUserSubcategory(user.id, category, oldSubcategory, newSubcategory);
      break;
    }
    case "delete_subcategory": {
      if (!category || !subcategory) {
        return NextResponse.json({ error: "Category and subcategory required" }, { status: 400 });
      }
      deleteUserSubcategory(user.id, category, subcategory);
      break;
    }
    default:
      return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 });
  }

  const updated = listUserCategories(user.id);
  return NextResponse.json({ ok: true, categories: updated });
}
