"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { User } from "@/lib/db";
import { UserAvatar } from "@/components/UserAvatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SignOutButton } from "@/components/SignOutButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { compressImage, formatFileSize } from "@/lib/image-compression";
import {
  IconArchive,
  IconArrowLeft,
  IconBox,
  IconCheck,
  IconEye,
  IconEyeOff,
  IconChevronDown,
  IconChevronRight,
  IconFlame,
  IconHeart,
  IconLock,
  IconPlus,
  IconRobot,
  IconShoppingCart,
  IconHierarchy,
  IconExport,
  IconSparkles,
  IconTrash,
} from "@/components/icons";
import { formatCategory, getCategoryStyle } from "@/lib/format";

interface AccountStats {
  totalItems?: number;
  ownedCount?: number;
  purgatoryCount?: number;
  offloadedCount?: number;
  wishlistCount?: number;
}

export interface UserCategoryData {
  category: string;
  subcategories: string[];
}

interface AccountClientProps {
  initialUser: User;
  initialCategories?: UserCategoryData[];
  stats?: AccountStats;
  initialBackup?: unknown;
}

export default function AccountClient({ initialUser, initialCategories = [] }: AccountClientProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<User>(initialUser);
  const [categories, setCategories] = useState<UserCategoryData[]>(initialCategories);
  const [catBusy, setCatBusy] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);

  // New category input
  const [newCatName, setNewCatName] = useState("");
  // Editing category
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");

  // Subcategory inputs keyed by category
  const [newSubcatNames, setNewSubcatNames] = useState<Record<string, string>>({});
  // Editing subcategory: { category: string, oldSub: string }
  const [editingSubcat, setEditingSubcat] = useState<{ category: string; oldSub: string } | null>(null);
  const [editSubcatName, setEditSubcatName] = useState("");
  // Auto-collapse each category by default: empty object means all collapsed
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const toggleCatExpand = (cat: string) => {
    setExpandedCats((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Confirmation dialogs
  const [catToDelete, setCatToDelete] = useState<string | null>(null);
  const [subcatToDelete, setSubcatToDelete] = useState<{ category: string; sub: string } | null>(null);
  const [name, setName] = useState(initialUser.name || "");
  const [email, setEmail] = useState(initialUser.email || "");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [confirmRemoveAvatar, setConfirmRemoveAvatar] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [avatarMsg, setAvatarMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [subInterval, setSubInterval] = useState<"trial" | "monthly" | "yearly">(
    initialUser.subscriptionInterval === "yearly"
      ? "yearly"
      : initialUser.subscriptionInterval === "trial"
      ? "trial"
      : "trial"
  );
  const [subBusy, setSubBusy] = useState(false);
  const [subMsg, setSubMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [confirmCancelSub, setConfirmCancelSub] = useState(false);

  const mutateCategories = async (body: Record<string, unknown>) => {
    setCatBusy(true);
    setCatError(null);
    try {
      const res = await fetch("/api/user/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update category");
      setCategories(data.categories);
      router.refresh();
      return true;
    } catch (err: unknown) {
      setCatError(err instanceof Error ? err.message : "Failed to update category");
      return false;
    } finally {
      setCatBusy(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const ok = await mutateCategories({ action: "add_category", category: newCatName.trim() });
    if (ok) setNewCatName("");
  };

  const handleRenameCategory = async (oldCategory: string) => {
    if (!editCatName.trim() || editCatName.trim().toLowerCase() === oldCategory.toLowerCase()) {
      setEditingCat(null);
      return;
    }
    const ok = await mutateCategories({
      action: "rename_category",
      oldCategory,
      newCategory: editCatName.trim(),
    });
    if (ok) setEditingCat(null);
  };

  const handleConfirmDeleteCategory = async () => {
    if (!catToDelete) return;
    await mutateCategories({ action: "delete_category", category: catToDelete });
    setCatToDelete(null);
  };

  const handleAddSubcategory = async (category: string) => {
    const sub = (newSubcatNames[category] || "").trim();
    if (!sub) return;
    const ok = await mutateCategories({
      action: "add_subcategory",
      category,
      subcategory: sub,
    });
    if (ok) {
      setNewSubcatNames((prev) => ({ ...prev, [category]: "" }));
    }
  };

  const handleRenameSubcategory = async (category: string, oldSub: string) => {
    if (!editSubcatName.trim() || editSubcatName.trim() === oldSub) {
      setEditingSubcat(null);
      return;
    }
    const ok = await mutateCategories({
      action: "rename_subcategory",
      category,
      oldSubcategory: oldSub,
      newSubcategory: editSubcatName.trim(),
    });
    if (ok) setEditingSubcat(null);
  };

  const handleConfirmDeleteSubcategory = async () => {
    if (!subcatToDelete) return;
    await mutateCategories({
      action: "delete_subcategory",
      category: subcatToDelete.category,
      subcategory: subcatToDelete.sub,
    });
    setSubcatToDelete(null);
  };

  const handleSubscribe = async (
    targetPlan: "free" | "premium",
    targetInterval: "monthly" | "yearly" | "trial" = subInterval
  ) => {
    setSubBusy(true);
    setSubMsg(null);
    try {
      if (targetPlan === "premium") {
        // Redirect to Stripe Hosted Checkout
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interval: targetInterval }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to start checkout");
        if (data.url) {
          window.location.href = data.url;
          return;
        }
      }

      // If user is managing existing subscription or cancelling
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }

      // Fallback
      const subRes = await fetch("/api/user/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: targetPlan, interval: targetInterval }),
      });
      const subData = await subRes.json();
      if (!subRes.ok) throw new Error(subData.error || "Failed to update subscription");
      setUser(subData.user);
      router.refresh();
    } catch (err: unknown) {
      setSubMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update subscription",
      });
    } finally {
      setSubBusy(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarBusy(true);
    setAvatarMsg(null);

    try {
      const compressed = await compressImage(file, { maxWidth: 800, maxHeight: 800, quality: 0.85 });
      const formData = new FormData();
      formData.append("photo", compressed);

      const res = await fetch("/api/user/avatar", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to upload photo");
      }

      const data = await res.json();
      setUser(data.user);
      setAvatarMsg({ type: "success", text: "Profile photo updated." });
      router.refresh();
    } catch (err: unknown) {
      setAvatarMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to upload photo",
      });
    } finally {
      setAvatarBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = () => {
    setConfirmRemoveAvatar(true);
  };

  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [cleanupMsg, setCleanupMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleCleanupOrphans = async () => {
    setCleanupBusy(true);
    setCleanupMsg(null);
    try {
      const res = await fetch("/api/storage/cleanup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Storage cleanup failed");
      const { deleted, freedBytes } = data.result;
      setCleanupMsg({
        type: "success",
        text:
          deleted > 0
            ? `Cleaned up ${deleted} orphaned file${deleted === 1 ? "" : "s"} (${formatFileSize(freedBytes)} reclaimed).`
            : "Storage is clean: no orphaned photos found.",
      });
    } catch (err: unknown) {
      setCleanupMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Cleanup failed",
      });
    } finally {
      setCleanupBusy(false);
    }
  };

  const confirmDeleteAvatar = async () => {
    setConfirmRemoveAvatar(false);
    setAvatarBusy(true);
    setAvatarMsg(null);

    try {
      const res = await fetch("/api/user/avatar", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to remove photo");
      }

      const data = await res.json();
      setUser(data.user);
      setAvatarMsg({ type: "success", text: "Profile photo removed." });
      router.refresh();
    } catch (err: unknown) {
      setAvatarMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to remove photo",
      });
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileBusy(true);
    setProfileMsg(null);

    const payload: { name: string; email: string; currentPassword?: string; newPassword?: string } = {
      name,
      email,
    };

    if (newPassword || currentPassword) {
      if (!currentPassword) {
        setProfileMsg({ type: "error", text: "Current password is required to set a new password." });
        setProfileBusy(false);
        return;
      }
      if (newPassword.length < 8) {
        setProfileMsg({ type: "error", text: "New password must be at least 8 characters." });
        setProfileBusy(false);
        return;
      }
      payload.currentPassword = currentPassword;
      payload.newPassword = newPassword;
    }

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update account");
      }

      const data = await res.json();
      setUser(data.user);
      setCurrentPassword("");
      setNewPassword("");
      setProfileMsg({ type: "success", text: "Account updated successfully." });
      router.refresh();
    } catch (err: unknown) {
      setProfileMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update account",
      });
    } finally {
      setProfileBusy(false);
    }
  };

  const isPro = user.plan === "premium";

  return (
    <div className="space-y-8">
      <header className="animate-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Account</p>
          <h1 className="display mt-2 text-4xl leading-[1.1] sm:text-5xl">Account options</h1>
        </div>
      </header>

      {/* Account Settings Card */}
      <section className="card p-4 sm:p-5">
        <form onSubmit={handleSaveAccount} className="space-y-3.5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {/* Clickable Profile Photo */}
            <div className="flex shrink-0 flex-col items-center gap-1.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                id="avatar-upload-input"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarBusy}
                className="group relative cursor-pointer rounded-full p-0.5 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-accent"
                title="Click to change profile picture"
              >
                <UserAvatar
                  name={user.name}
                  email={user.email}
                  avatarPath={user.avatarPath}
                  size={58}
                  className="ring-2 ring-line transition-opacity group-hover:opacity-85"
                />
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 text-white text-[10px] font-medium">
                  Change
                </span>
              </button>

              {user.avatarPath && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={avatarBusy}
                  className="text-[10px] text-danger hover:underline"
                >
                  Remove picture
                </button>
              )}
            </div>

            {/* Inputs: Display Name and Email on top line, Current Password and New Password on bottom line */}
            <div className="flex-1 space-y-2.5">
              {/* Top line: Display Name & Email Address */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label text-xs mb-1" htmlFor="user-name">
                    Display Name
                  </label>
                  <input
                    id="user-name"
                    type="text"
                    className="input text-xs sm:text-sm py-1.5 h-8.5"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Tom"
                  />
                </div>
                <div>
                  <label className="label text-xs mb-1" htmlFor="user-email">
                    Email Address
                  </label>
                  <input
                    id="user-email"
                    type="email"
                    className="input text-xs sm:text-sm py-1.5 h-8.5"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Bottom line: Current Password & New Password */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label text-xs mb-1" htmlFor="current-password">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      id="current-password"
                      type={showOldPassword ? "text" : "password"}
                      className="input pr-8 text-xs sm:text-sm py-1.5 h-8.5"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Required only to change password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                      tabIndex={-1}
                      title={showOldPassword ? "Hide password" : "Show password"}
                    >
                      {showOldPassword ? <IconEyeOff width={14} height={14} /> : <IconEye width={14} height={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label text-xs mb-1" htmlFor="new-password">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      className="input pr-8 text-xs sm:text-sm py-1.5 h-8.5"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      minLength={8}
                      placeholder="Min 8 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                      tabIndex={-1}
                      title={showNewPassword ? "Hide password" : "Show password"}
                    >
                      {showNewPassword ? <IconEyeOff width={14} height={14} /> : <IconEye width={14} height={14} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {avatarMsg && (
            <div
              className={`rounded-lg px-3 py-1.5 text-xs ${
                avatarMsg.type === "success"
                  ? "border border-accent-line bg-accent-soft text-accent"
                  : "border border-danger-line bg-danger-soft text-danger"
              }`}
            >
              {avatarMsg.text}
            </div>
          )}

          {profileMsg && (
            <div
              className={`rounded-lg px-3 py-1.5 text-xs ${
                profileMsg.type === "success"
                  ? "border border-accent-line bg-accent-soft text-accent"
                  : "border border-danger-line bg-danger-soft text-danger"
              }`}
            >
              {profileMsg.text}
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="btn-primary px-4 py-1.5 text-xs"
              disabled={profileBusy}
            >
              <IconCheck width={14} height={14} />
              {profileBusy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>

        {/* Data Export inside Account Settings Card */}
        <div className="border-t border-line-soft pt-3 mt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="display text-sm font-semibold">Export data</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[9px] font-bold text-accent uppercase tracking-wider">
                  <IconSparkles width={9} height={9} />
                  Pro
                </span>
              </div>
              <p className="text-[11px] text-muted">
                Download your smpl. data as CSV spreadsheets and JSON archives.
              </p>
            </div>

            {!isPro && (
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("subscription");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                className="btn-primary text-xs flex items-center gap-1.5 py-1 px-2.5"
              >
                <IconLock width={12} height={12} />
                Upgrade to Pro to export
              </button>
            )}
          </div>

          {!isPro && (
            <div className="mt-2.5 rounded-lg border border-line bg-paper p-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-wash text-muted">
                  <IconLock width={13} height={13} />
                </span>
                <div>
                  <p className="text-xs font-semibold text-ink">Data export is locked on the Free tier</p>
                  <p className="text-[10px] text-muted">
                    Upgrade to Pro to download CSV spreadsheets and full JSON database backups anytime.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleSubscribe("premium", subInterval)}
                disabled={subBusy}
                className="btn-secondary text-xs shrink-0 py-1 px-2.5"
              >
                Unlock with Pro
              </button>
            </div>
          )}

          <div className={`mt-2.5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 ${!isPro ? "opacity-60 pointer-events-none select-none" : ""}`}>
            <a
              href={isPro ? "/api/export?type=inventory" : "#"}
              download
              className="flex items-center justify-between gap-2 rounded-lg border border-line bg-paper px-2.5 py-2 transition hover:border-line-strong hover:shadow-sm"
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold text-ink truncate">Inventory</div>
                <div className="text-[10px] text-accent font-medium truncate">{isPro ? "Download CSV ↓" : "CSV (Pro)"}</div>
              </div>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
                <IconBox width={12} height={12} />
              </span>
            </a>

            <a
              href={isPro ? "/api/export?type=purgatory" : "#"}
              download
              className="flex items-center justify-between gap-2 rounded-lg border border-line bg-paper px-2.5 py-2 transition hover:border-line-strong hover:shadow-sm"
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold text-ink truncate">Purgatory</div>
                <div className="text-[10px] text-clay font-medium truncate">{isPro ? "Download CSV ↓" : "CSV (Pro)"}</div>
              </div>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-clay-soft text-clay">
                <IconFlame width={12} height={12} />
              </span>
            </a>

            <a
              href={isPro ? "/api/export?type=wishlist" : "#"}
              download
              className="flex items-center justify-between gap-2 rounded-lg border border-line bg-paper px-2.5 py-2 transition hover:border-line-strong hover:shadow-sm"
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold text-ink truncate">Wishlist</div>
                <div className="text-[10px] text-warn font-medium truncate">{isPro ? "Download CSV ↓" : "CSV (Pro)"}</div>
              </div>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-warn-soft text-warn">
                <IconHeart width={12} height={12} />
              </span>
            </a>

            <a
              href={isPro ? "/api/export?type=offloaded" : "#"}
              download
              className="flex items-center justify-between gap-2 rounded-lg border border-line bg-paper px-2.5 py-2 transition hover:border-line-strong hover:shadow-sm"
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold text-ink truncate">Offloaded</div>
                <div className="text-[10px] text-ink font-medium truncate">{isPro ? "Download CSV ↓" : "CSV (Pro)"}</div>
              </div>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-wash text-ink-soft">
                <IconArchive width={12} height={12} />
              </span>
            </a>

            <a
              href={isPro ? "/api/export?type=json" : "#"}
              download
              className="flex items-center justify-between gap-2 rounded-lg border border-line bg-paper px-2.5 py-2 transition hover:border-line-strong hover:shadow-sm"
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold text-ink truncate">Backup</div>
                <div className="text-[10px] text-brand font-medium truncate">{isPro ? "Download JSON ↓" : "JSON (Pro)"}</div>
              </div>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand/10 text-brand">
                <IconBox width={12} height={12} />
              </span>
            </a>
          </div>

          {/* Storage Maintenance: Clean up orphaned photos */}
          <div className="mt-4 pt-3 border-t border-line/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div>
              <div className="text-xs font-semibold text-ink">Storage Maintenance</div>
              <p className="text-[11px] text-muted">
                Scan disk and remove orphaned photo files left behind from removed items.
              </p>
              {cleanupMsg && (
                <p className={`mt-1 text-xs font-medium ${cleanupMsg.type === "success" ? "text-accent" : "text-danger"}`}>
                  {cleanupMsg.text}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleCleanupOrphans}
              disabled={cleanupBusy}
              className="btn-secondary text-xs shrink-0 py-1.5 px-3 whitespace-nowrap"
            >
              {cleanupBusy ? "Scanning..." : "Clean Orphaned Photos"}
            </button>
          </div>
        </div>
      </section>

      {/* Categories & Membership Side by Side */}
      <div className="grid gap-6 lg:grid-cols-2 items-stretch">
        {/* Categories & Subcategories Customization */}
      <section className="card p-4 sm:p-5 flex flex-col h-full">
        <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="display text-lg">Categories</h2>
            {!isPro ? (
              <span className="rounded-full bg-wash px-2 py-0.5 text-[10px] font-medium text-muted">
                Free: {categories.length}/5
              </span>
            ) : (
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent">
                Pro: Unlimited
              </span>
            )}
          </div>
          
          <form onSubmit={handleAddCategory} className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder={!isPro && categories.length >= 5 ? "Limit (5/5)" : "New category…"}
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              disabled={!isPro && categories.length >= 5}
              className="input py-1 px-2.5 text-xs h-8 w-36 sm:w-44 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={catBusy || !newCatName.trim() || (!isPro && categories.length >= 5)}
              className="btn-primary text-xs h-8 px-2.5 shrink-0 disabled:opacity-50"
            >
              <IconPlus width={12} height={12} />
              Add
            </button>
          </form>
        </div>

        {!isPro && categories.length > 5 && (
          <p className="mt-2 text-[11px] text-muted shrink-0">
            All your {categories.length} custom categories and subcategories are safely stored. Creating new categories is paused until you upgrade to Pro or reduce below the free limit.
          </p>
        )}

        {catError && (
          <div className="mt-3 shrink-0 rounded-lg border border-danger-line bg-danger-soft p-2.5 text-xs text-danger">
            {catError}
          </div>
        )}

        {/* Categories list filling all available tile space */}
        <div className="mt-3.5 space-y-2 flex-1 min-h-[240px] overflow-y-auto pr-1">
            {categories.length === 0 ? (
              <p className="text-xs text-muted py-6 text-center">No categories configured yet.</p>
            ) : (
              categories.map((c) => {
                const isEditing = editingCat === c.category;
                const isExpanded = Boolean(expandedCats[c.category]);
                const style = getCategoryStyle(c.category);

                return (
                  <div
                    key={c.category}
                    className="rounded-lg border border-line bg-paper p-2.5 sm:p-2.5 transition-all"
                  >
                    {/* Category Header Row */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5 flex-1">
                            <input
                              type="text"
                              autoFocus
                              value={editCatName}
                              onChange={(e) => setEditCatName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleRenameCategory(c.category);
                                if (e.key === "Escape") setEditingCat(null);
                              }}
                              className="input py-1 px-2.5 sm:py-0.5 sm:px-2 text-xs h-8 sm:h-7 w-36 sm:w-32"
                            />
                            <button
                              type="button"
                              onClick={() => handleRenameCategory(c.category)}
                              disabled={catBusy}
                              className="btn-primary text-xs sm:text-[11px] py-1 px-2.5 sm:py-0.5 sm:px-2 h-8 sm:h-7"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCat(null)}
                              className="btn-secondary text-xs sm:text-[11px] py-1 px-2.5 sm:py-0.5 sm:px-2 h-8 sm:h-7"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 truncate">
                            <button
                              type="button"
                              onClick={() => toggleCatExpand(c.category)}
                              className="flex items-center gap-1.5 truncate group cursor-pointer text-left"
                              title={isExpanded ? "Collapse subcategories" : "Expand subcategories"}
                            >
                              <span
                                className={`inline-flex items-center rounded px-3 py-1.5 sm:px-2 sm:py-0.5 text-sm sm:text-xs font-semibold truncate ${style}`}
                              >
                                {formatCategory(c.category)}
                              </span>
                              <span className="text-xs sm:text-[10px] text-muted shrink-0">
                                ({c.subcategories.length})
                              </span>
                              <span className="text-muted group-hover:text-ink transition-transform">
                                <IconChevronDown
                                  width={14}
                                  height={14}
                                  className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                                />
                              </span>
                            </button>
                          </div>
                        )}
                      </div>

                      {!isEditing && (
                        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 text-xs text-muted">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCat(c.category);
                              setEditCatName(c.category);
                            }}
                            className="p-1.5 sm:p-0 hover:text-ink transition-colors cursor-pointer text-xs sm:text-[11px] font-medium"
                          >
                            Rename
                          </button>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() => setCatToDelete(c.category)}
                            className="p-1.5 sm:p-0 hover:text-danger text-danger/80 transition-colors cursor-pointer text-xs sm:text-[11px] font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Subcategories list - auto collapsed by default */}
                    {isExpanded && (
                      <div className="mt-2.5 pt-2 border-t border-line-soft flex flex-wrap items-center gap-2 sm:gap-1.5 animate-fade">
                        {c.subcategories.map((sub) => {
                          const isEditingSub =
                            editingSubcat?.category === c.category && editingSubcat?.oldSub === sub;

                          return (
                            <div
                              key={sub}
                              className="inline-flex items-center rounded-md border border-line bg-card py-1.5 px-2.5 sm:py-0.5 sm:px-1.5 text-xs sm:text-[11px]"
                            >
                              {isEditingSub ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    autoFocus
                                    value={editSubcatName}
                                    onChange={(e) => setEditSubcatName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleRenameSubcategory(c.category, sub);
                                      if (e.key === "Escape") setEditingSubcat(null);
                                    }}
                                    className="input py-0.5 px-1.5 text-xs sm:text-[11px] h-7 sm:h-5 w-28 sm:w-24"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRenameSubcategory(c.category, sub)}
                                    disabled={catBusy}
                                    className="text-xs sm:text-[10px] font-semibold text-accent hover:underline p-1"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingSubcat(null)}
                                    className="text-xs sm:text-[10px] text-muted hover:text-ink p-1"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span className="font-medium text-ink truncate max-w-[120px] sm:max-w-[100px]">{sub}</span>
                                  <div className="ml-2 sm:ml-1.5 flex items-center gap-1 text-muted/70">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingSubcat({ category: c.category, oldSub: sub });
                                        setEditSubcatName(sub);
                                      }}
                                      className="p-1 sm:p-0 hover:text-ink transition-colors cursor-pointer text-xs sm:text-[9px]"
                                      title="Rename"
                                    >
                                      ✎
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSubcatToDelete({ category: c.category, sub })
                                      }
                                      className="p-1 sm:p-0 hover:text-danger transition-colors cursor-pointer text-xs sm:text-[9px]"
                                      title="Delete"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}

                        {/* Add Subcategory Inline Input */}
                        {(!isPro && c.subcategories.length >= 2) ? (
                          <span className="text-xs sm:text-[10px] text-muted italic">Max 2 reached</span>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <input
                              type="text"
                              placeholder="+ Subcategory"
                              value={newSubcatNames[c.category] || ""}
                              onChange={(e) =>
                                setNewSubcatNames((prev) => ({
                                  ...prev,
                                  [c.category]: e.target.value,
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleAddSubcategory(c.category);
                                }
                              }}
                              className="input py-1 px-2 sm:py-0.5 sm:px-1.5 text-xs sm:text-[11px] h-7 sm:h-6 w-28 sm:w-24 bg-card/60 focus:bg-card"
                            />
                            {(newSubcatNames[c.category] || "").trim() && (
                              <button
                                type="button"
                                onClick={() => handleAddSubcategory(c.category)}
                                disabled={catBusy}
                                className="btn-primary py-1 px-2 sm:py-0 sm:px-1.5 text-xs sm:text-[10px] h-7 sm:h-6"
                              >
                                Add
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
        {/* Membership & Subscription Card */}
        <section id="subscription" className="card p-4 sm:p-5 scroll-mt-6 flex flex-col h-full justify-between">
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="display text-lg">Membership & plan</h2>
              {isPro ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-accent">
                  <IconSparkles width={10} height={10} />
                  Pro Active
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-wash px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Free Tier
                </span>
              )}
            </div>

            {isPro && (
              <button
                type="button"
                onClick={() => setConfirmCancelSub(true)}
                disabled={subBusy}
                className="text-[11px] text-muted underline hover:text-danger transition-colors"
              >
                Cancel subscription
              </button>
            )}
          </div>

          <p className="mt-1 text-xs text-muted">
            {isPro
              ? `Unlocked on a ${
                  user.subscriptionInterval === "trial" ? "2-week free trial" : user.subscriptionInterval || "monthly"
                } plan${user.subscriptionRenewsAt ? ` (renews on ${user.subscriptionRenewsAt})` : ""}.`
              : "Upgrade to unlock AI Advisor, Wishlist cooldown tracker, and unlimited categories."}
          </p>

          {subMsg && (
            <div
              className={`mt-3 rounded-lg p-2.5 text-xs ${
                subMsg.type === "success"
                  ? "border border-accent-line bg-accent-soft text-accent"
                  : "border border-danger-line bg-danger-soft text-danger"
              }`}
            >
              {subMsg.text}
            </div>
          )}

          {/* Pricing selector */}
          <div className="mt-3.5 flex items-center justify-center">
            <div className="inline-flex flex-wrap justify-center rounded-xl border border-line bg-paper p-0.5 shadow-sm gap-0.5">
              <button
                type="button"
                onClick={() => setSubInterval("trial")}
                className={`flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium transition-all ${
                  subInterval === "trial"
                    ? "bg-brand text-brand-fg shadow-sm"
                    : "text-muted hover:text-ink"
                }`}
              >
                <span>Free Trial (2 wks)</span>
                <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700 dark:text-emerald-400">
                  $0
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSubInterval("monthly")}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition-all ${
                  subInterval === "monthly"
                    ? "bg-brand text-brand-fg shadow-sm"
                    : "text-muted hover:text-ink"
                }`}
              >
                Monthly ($4.29/mo)
              </button>
              <button
                type="button"
                onClick={() => setSubInterval("yearly")}
                className={`flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium transition-all ${
                  subInterval === "yearly"
                    ? "bg-brand text-brand-fg shadow-sm"
                    : "text-muted hover:text-ink"
                }`}
              >
                <span>Yearly ($34.99/yr)</span>
                <span className="rounded-full bg-accent-soft px-1.5 py-0.2 text-[9px] font-bold text-accent">
                  -32%
                </span>
              </button>
            </div>
          </div>

          {/* Pro Tier Card */}
          <div className="mt-3.5">
            <div
              className={`flex flex-col justify-between rounded-xl border p-4 transition-all ${
                isPro
                  ? "border-accent bg-accent-soft/20 ring-1 ring-accent"
                  : "border-accent/40 bg-paper shadow-sm"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-semibold text-ink">Pro Plan</h3>
                    <IconSparkles width={13} height={13} className="text-accent" />
                  </div>
                  {isPro ? (
                    <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold text-accent">
                      Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent">
                      Upgrade
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="display text-2xl font-semibold text-ink">
                    {subInterval === "trial" ? "$0" : subInterval === "yearly" ? "$34.99" : "$4.29"}
                  </span>
                  <span className="text-[11px] text-muted">
                    {subInterval === "trial"
                      ? "USD for 2 weeks, then $4.29/mo"
                      : subInterval === "yearly"
                      ? "USD / yr ($2.92/mo)"
                      : "USD / month"}
                  </span>
                </div>

                <ul className="mt-2.5 space-y-1.5 text-xs text-ink-soft">
                  <li className="flex items-center gap-1.5">
                    <IconRobot width={14} height={14} className="text-accent shrink-0" />
                    <span className="rainbow-gradient font-semibold">
                      AI Advisor: Data-driven offload recommendations
                    </span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <IconShoppingCart width={14} height={14} className="text-accent shrink-0" />
                    <span>Wishlist: Track items you don&apos;t yet own, with a 30-day cooldown tracker</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <IconHierarchy width={14} height={14} className="text-accent shrink-0" />
                    <span>Unlimited custom categories & subcategories</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <IconExport width={14} height={14} className="text-accent shrink-0" />
                    <span>Complete CSV & JSON data exporting</span>
                  </li>
                </ul>
              </div>

              <div className="mt-3.5">
                {isPro ? (
                  user.subscriptionInterval !== subInterval ? (
                    <button
                      type="button"
                      onClick={() => handleSubscribe("premium", subInterval)}
                      disabled={subBusy}
                      className="btn-primary w-full text-xs py-1.5"
                    >
                      {subBusy
                        ? "Updating…"
                        : `Switch to ${
                            subInterval === "trial"
                              ? "Free Trial (2 weeks)"
                              : subInterval === "yearly"
                              ? "Yearly ($34.99/yr)"
                              : "Monthly ($4.29/mo)"
                          }`}
                    </button>
                  ) : (
                    <div className="rounded-lg bg-accent-soft py-1.5 text-center text-xs font-semibold text-accent">
                      Active Subscription
                    </div>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSubscribe("premium", subInterval)}
                    disabled={subBusy}
                    className="btn-primary w-full text-xs py-1.5 shadow-sm"
                  >
                    <IconSparkles width={13} height={13} />
                    {subBusy
                      ? "Upgrading…"
                      : subInterval === "trial"
                      ? "Start 2-Week Free Trial — $0"
                      : `Upgrade to Pro — ${subInterval === "yearly" ? "$34.99/yr" : "$4.29/mo"}`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Free Trial & Cancellation */}
        <div className="mt-3.5 border-t border-line-soft pt-3 shrink-0">
          <div className="flex items-start gap-2 text-[11px] text-muted leading-relaxed">
            <span className="font-semibold text-ink shrink-0">14-Day Free Trial:</span>
            <span>
              We offer a 14-day free Pro trial so you can experience all premium features risk-free. Subscriptions can be cancelled anytime with a single click in your account or Stripe billing portal.
            </span>
          </div>
        </div>
      </section>
      </div>



      <ConfirmDialog
        open={confirmCancelSub}
        title="Cancel Pro subscription?"
        message={
          <div className="space-y-2 text-left">
            <p className="text-ink">
              Your account will be moved to the Free tier.
            </p>
            <p className="font-semibold text-ink text-xs">
              All your data is safely preserved:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs text-muted">
              <li>All wishlist items, priorities, and cooldown progress are saved.</li>
              <li>All custom categories and subcategories remain stored.</li>
              <li>Your inventory items, photos, and histories are never removed.</li>
            </ul>
            <p className="text-xs text-muted">
              You can upgrade back to Pro anytime to resume full access.
            </p>
          </div>
        }
        confirmLabel="Confirm cancellation"
        cancelLabel="Keep Pro"
        variant="warn"
        busy={subBusy}
        onConfirm={() => {
          setConfirmCancelSub(false);
          handleSubscribe("free");
        }}
        onCancel={() => setConfirmCancelSub(false)}
      />

      <ConfirmDialog
        open={confirmRemoveAvatar}
        title="Remove profile picture?"
        message="Are you sure you want to remove your profile photo? Your avatar will revert to your initials."
        confirmLabel="Remove photo"
        busy={avatarBusy}
        onConfirm={confirmDeleteAvatar}
        onCancel={() => setConfirmRemoveAvatar(false)}
      />

      <ConfirmDialog
        open={Boolean(catToDelete)}
        title={`Delete category "${formatCategory(catToDelete)}"?`}
        message={`Are you sure you want to delete this category? Any items or wishlist entries currently assigned to "${formatCategory(catToDelete)}" will be reassigned to "Misc".`}
        confirmLabel="Delete Category"
        busy={catBusy}
        onConfirm={handleConfirmDeleteCategory}
        onCancel={() => setCatToDelete(null)}
      />

      <ConfirmDialog
        open={Boolean(subcatToDelete)}
        title={`Delete subcategory "${subcatToDelete?.sub}"?`}
        message={`Are you sure you want to delete "${subcatToDelete?.sub}" from ${formatCategory(subcatToDelete?.category)}? Items using this subcategory will have their subcategory cleared.`}
        confirmLabel="Delete Subcategory"
        busy={catBusy}
        onConfirm={handleConfirmDeleteSubcategory}
        onCancel={() => setSubcatToDelete(null)}
      />
    </div>
  );
}
