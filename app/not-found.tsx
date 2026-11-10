import Link from "next/link";
import { IconArrowLeft, IconSearch } from "@/components/icons";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-paper text-ink-400">
        <IconSearch width={22} height={22} />
      </span>
      <p className="eyebrow">404</p>
      <h1 className="display mt-2 text-4xl">Nothing here</h1>
      <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-muted">
        That item does not exist — maybe it already found a new home.
      </p>
      <Link href="/items" className="btn-primary mt-6">
        <IconArrowLeft width={15} height={15} />
        Back to inventory
      </Link>
    </div>
  );
}
