import ItemForm from "../ItemForm";

export const dynamic = "force-dynamic";

export default function NewItemPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <header className="animate-rise">
        <p className="eyebrow">New item</p>
        <h1 className="display mt-2 text-4xl leading-[1.1]">Add an item</h1>
        <p className="mt-2 text-[15px] text-muted">
          Every possession. The more honest the usage dates, the better the suggestions.
        </p>
      </header>
      <ItemForm />
    </div>
  );
}
