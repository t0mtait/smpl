import { notFound } from "next/navigation";
import Link from "next/link";
import { getItem, listUserCategories } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { IconArrowLeft } from "@/components/icons";
import { ActiveSectionSync } from "@/components/NavigationContext";
import ItemForm from "../../ItemForm";

export const dynamic = "force-dynamic";

export default async function EditItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ returnTo?: string }>;
}) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const user = await requireUser(`/items/${id}/edit`);
  const item = getItem(user.id, Number(id));
  if (!item) notFound();
  const initialCategories = listUserCategories(user.id);

  const isOffloaded =
    item.status === "sold" ||
    item.status === "donated" ||
    item.status === "disposed" ||
    item.status === "closed" ||
    item.status === "offloaded" ||
    Boolean(item.offloadedDate && item.status !== "owned");

  const rawReturnTo = typeof sp.returnTo === "string" ? sp.returnTo : null;
  const navSection =
    item.status === "purgatory" || rawReturnTo?.startsWith("/purgatory")
      ? "purgatory"
      : isOffloaded || rawReturnTo?.startsWith("/offloaded")
      ? "offloaded"
      : rawReturnTo?.startsWith("/wishlist")
      ? "wishlist"
      : "items";

  const backHref = `/items/${item.id}${rawReturnTo ? `?returnTo=${encodeURIComponent(rawReturnTo)}` : ""}`;

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <ActiveSectionSync section={navSection} />
      <header className="animate-rise">
        <p className="eyebrow">Edit</p>
        <h1 className="display mt-2 text-4xl leading-[1.1]">{item.name}</h1>
        <Link
          href={backHref}
          className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-ink"
        >
          <IconArrowLeft width={15} height={15} />
          Back to item
        </Link>
      </header>
      <ItemForm item={item} initialCategories={initialCategories} />
    </div>
  );
}
