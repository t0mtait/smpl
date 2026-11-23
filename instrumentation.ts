export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { tryRestoreDatabaseFromStorage } = await import("./lib/backup");
      await tryRestoreDatabaseFromStorage();
    } catch (err) {
      console.warn("[Startup] Database restore check encountered an error:", err);
    }
  }
}
