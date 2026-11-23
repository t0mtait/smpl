"use client";

import { useEffect } from "react";
import { IconTrash, IconWarning, IconX } from "@/components/icons";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warn";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  variant = "danger",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="card animate-rise w-full max-w-md p-6 shadow-2xl border border-line bg-card">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
              variant === "danger"
                ? "bg-danger-soft text-danger"
                : "bg-warn-soft text-warn"
            }`}
          >
            {variant === "danger" ? (
              <IconTrash width={22} height={22} />
            ) : (
              <IconWarning width={22} height={22} />
            )}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 id="confirm-dialog-title" className="display text-xl text-ink font-semibold">
              {title}
            </h3>
            {message ? (
              <div className="mt-2 text-sm text-muted leading-relaxed">
                {message}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-muted hover:text-ink transition-colors p-1 -mr-2 -mt-2 rounded-lg"
            aria-label="Close dialog"
          >
            <IconX width={18} height={18} />
          </button>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-line">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="btn-secondary text-sm font-medium"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={
              variant === "danger"
                ? "btn-danger text-sm font-semibold flex items-center gap-1.5"
                : "btn-clay text-sm font-semibold flex items-center gap-1.5"
            }
          >
            <IconTrash width={15} height={15} />
            {busy ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
