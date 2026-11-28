"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconCopy } from "@/components/icons";

export function DuplicateButton({ itemId }: { itemId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleDuplicate = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/items/${itemId}/duplicate`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.item?.id) {
          router.push(`/items/${data.item.id}`);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDuplicate}
      disabled={busy}
      className="btn-secondary"
      title="Duplicate this item"
    >
      <IconCopy width={15} height={15} />
      {busy ? "Duplicating…" : "Duplicate"}
    </button>
  );
}
