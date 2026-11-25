/**
 * Detect whether the client is a large desktop device (laptop, PC) where
 * auto-focusing/selecting an input does not trigger an on-screen virtual keyboard.
 * On phones and tablets (including iPads of all sizes), returns false to prevent
 * the virtual keyboard from popping up and cluttering the screen.
 */
export function shouldAutoSelectInput(): boolean {
  if (typeof window === "undefined") return false;

  // Screen size check: phones and smaller tablets in portrait
  if (window.innerWidth < 1024) return false;

  // Touch / device detection:
  // - navigator.maxTouchPoints > 1 (touch devices including iPads and phones)
  // - navigator.platform === "MacIntel" && maxTouchPoints > 1 (iPadOS desktop-class Safari)
  // - pointer: coarse (touchscreen is the primary input device)
  const nav = typeof navigator !== "undefined" ? navigator : null;
  const isTouchDevice =
    (nav && (
      nav.maxTouchPoints > 1 ||
      /iPad|iPhone|iPod|Android/i.test(nav.userAgent) ||
      (nav.platform === "MacIntel" && nav.maxTouchPoints > 1)
    )) ||
    (typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches);

  return !isTouchDevice;
}
