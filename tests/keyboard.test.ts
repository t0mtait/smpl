import { isQuickSaveKey } from "../lib/keyboard.ts";

function check(desc: string, condition: boolean) {
  if (!condition) {
    console.error(`  fail ${desc}`);
    process.exit(1);
  }
  console.log(`  ok   ${desc}`);
}

console.log("\n── keyboard shortcuts ──\n");

// 1. Command + Enter (Mac)
check("metaKey + Enter is recognized as quick save", isQuickSaveKey({ metaKey: true, ctrlKey: false, key: "Enter" } as any));

// 2. Ctrl + Enter (Windows / Linux)
check("ctrlKey + Enter is recognized as quick save", isQuickSaveKey({ metaKey: false, ctrlKey: true, key: "Enter" } as any));

// 3. Both metaKey and ctrlKey + Enter
check("metaKey + ctrlKey + Enter is recognized as quick save", isQuickSaveKey({ metaKey: true, ctrlKey: true, key: "Enter" } as any));

// 4. Plain Enter without modifier is NOT quick save
check("plain Enter without modifier is not quick save", !isQuickSaveKey({ metaKey: false, ctrlKey: false, key: "Enter" } as any));

// 5. Shift + Enter is NOT quick save
check("shiftKey + Enter is not quick save", !isQuickSaveKey({ metaKey: false, ctrlKey: false, shiftKey: true, key: "Enter" } as any));

// 6. Alt + Enter is NOT quick save
check("altKey + Enter is not quick save", !isQuickSaveKey({ metaKey: false, ctrlKey: false, altKey: true, key: "Enter" } as any));

// 7. Command + another key (e.g. 's') is NOT quick save
check("metaKey + 's' is not quick save key", !isQuickSaveKey({ metaKey: true, ctrlKey: false, key: "s" } as any));

// 8. Ctrl + another key is NOT quick save
check("ctrlKey + 'k' is not quick save key", !isQuickSaveKey({ metaKey: false, ctrlKey: true, key: "k" } as any));

console.log("\n8 passed, 0 failed\n");
