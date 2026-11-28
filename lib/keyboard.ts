import type { KeyboardEvent } from "react";

/**
 * Detects whether a keyboard event matches Command+Enter (Mac) or Ctrl+Enter (Windows/Linux).
 */
export function isQuickSaveKey(e: KeyboardEvent | globalThis.KeyboardEvent): boolean {
  return (e.metaKey || e.ctrlKey) && e.key === "Enter";
}

/**
 * Universal keyboard event handler for forms that executes a quick save
 * on Command+Enter or Ctrl+Enter.
 *
 * It triggers native constraint validation and form submission via requestSubmit(),
 * ensuring required fields and patterns are respected before submission.
 */
export function handleFormQuickSave(e: KeyboardEvent<HTMLFormElement>) {
  if (isQuickSaveKey(e)) {
    e.preventDefault();
    if (typeof e.currentTarget.requestSubmit === "function") {
      e.currentTarget.requestSubmit();
    } else {
      e.currentTarget.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    }
  }
}
