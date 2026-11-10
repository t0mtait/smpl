import ItemForm from "../ItemForm";

export const dynamic = "force-dynamic";

export default function NewItemPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add an item</h1>
        <p className="mt-1 text-sm text-ink-500">
          Every possession. The more honest the usage dates, the better the suggestions.
        </p>
      </div>
      <ItemForm />
    </div>
  );
}
