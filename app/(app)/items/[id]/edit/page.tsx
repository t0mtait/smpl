import { notFound } from "next/navigation";
import Link from "next/link";
import { getItem } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { IconArrowLeft } from "@/components/icons";
import ItemForm from "../../ItemForm";

export const dynamic = "force-dynamic";

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/items/${id}/edit`);
  const item = getItem(user.id, Number(id));
  if (!item) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <header className="animate-rise">
        <p className="eyebrow">Edit</p>
        <h1 className="display mt-2 text-4xl leading-[1.1]">{item.name}</h1>
        <Link
          href={`/items/${item.id}`}
          className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-ink"
        >
          <IconArrowLeft width={15} height={15} />
          Back to item
        </Link>
      </header>
      <ItemForm item={item} />
    </div>
  );
}
