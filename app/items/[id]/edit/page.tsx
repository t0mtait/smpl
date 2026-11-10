import { notFound } from "next/navigation";
import Link from "next/link";
import { getItem } from "@/lib/db";
import ItemForm from "../../ItemForm";

export const dynamic = "force-dynamic";

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = getItem(Number(id));
  if (!item) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Edit {item.name}</h1>
          <Link href={`/items/${item.id}`} className="mt-1 inline-block text-sm text-ink-500 hover:underline">
            ← Back to item
          </Link>
        </div>
      </div>
      <ItemForm item={item} />
    </div>
  );
}
