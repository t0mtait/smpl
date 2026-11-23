"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { User } from "@/lib/db";
import { UserAvatar } from "@/components/UserAvatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SignOutButton } from "@/components/SignOutButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  IconArchive,
  IconArrowLeft,
  IconBox,
  IconCamera,
  IconCheck,
  IconFlame,
  IconHeart,
  IconLock,
  IconPlus,
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

  // Confirmation dialogs
  const [catToDelete, setCatToDelete] = useState<string | null>(null);
  const [subcatToDelete, setSubcatToDelete] = useState<{ category: string; sub: string } | null>(null);
  const [name, setName] = useState(initialUser.name || "");
  const [email, setEmail] = useState(initialUser.email || "");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [confirmRemoveAvatar, setConfirmRemoveAvatar] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [avatarMsg, setAvatarMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [subInterval, setSubInterval] = useState<"monthly" | "yearly">(
    initialUser.subscriptionInterval === "yearly" ? "yearly" : "monthly"
  );
  const [subBusy, setSubBusy] = useState(false);
  const [subMsg, setSubMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  const handleSubscribe = async (targetPlan: "free" | "premium", targetInterval: "monthly" | "yearly" = subInterval) => {
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

    const formData = new FormData();
    formData.append("photo", file);

    try {
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

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileBusy(true);
    setProfileMsg(null);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update profile");
      }

      const data = await res.json();
      setUser(data.user);
      setProfileMsg({ type: "success", text: "Profile saved successfully." });
      router.refresh();
    } catch (err: unknown) {
      setProfileMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update profile",
      });
    } finally {
      setProfileBusy(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword.length < 8) {
      setPasswordMsg({ type: "error", text: "New password must be at least 8 characters" });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "Passwords do not match" });
      return;
    }

    setPasswordBusy(true);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to change password");
      }

      setPasswordMsg({ type: "success", text: "Password changed successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      setPasswordMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to change password",
      });
    } finally {
      setPasswordBusy(false);
    }
  };

  const isPro = user.plan === "premium";

  return (
    <div className="space-y-8">
      <header className="animate-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Account</p>
          <h1 className="display mt-2 text-4xl leading-[1.1] sm:text-5xl">Account options</h1>
          <p className="mt-2 text-[15px] text-muted">
            Manage your personal profile, credentials, and app preferences.
          </p>
        </div>
        <Link href="/" className="btn-secondary">
          <IconArrowLeft width={15} height={15} />
          Back to Dashboard
        </Link>
      </header>

      {/* Combined Profile, Credentials & Security Card */}
      <section className="card p-6 sm:p-7 space-y-6">
        <div>
          <h2 className="display text-xl">Account settings</h2>
          <p className="mt-1 text-[13px] text-muted">
            Manage your profile picture, account details, and password in one place.
          </p>
        </div>

        {/* Top Section: Photo and Personal Info */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Avatar Area (4 cols on lg) */}
          <div className="lg:col-span-4 rounded-xl border border-line bg-shell/50 p-4 space-y-3">
            <label className="label mb-1">Profile photo</label>
            <div className="flex items-center gap-4">
              <UserAvatar
                name={user.name}
                email={user.email}
                avatarPath={user.avatarPath}
                size={68}
              />
              <div className="space-y-2 min-w-0 flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                  id="avatar-upload-input"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    htmlFor="avatar-upload-input"
                    className={`btn-secondary cursor-pointer py-1.5 px-3 text-xs ${avatarBusy ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    <IconCamera width={14} height={14} />
                    {avatarBusy ? "Uploading…" : "Upload"}
                  </label>

                  {user.avatarPath && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={avatarBusy}
                      className="btn-secondary py-1.5 px-3 text-xs text-danger hover:border-danger-line"
                    >
                      <IconTrash width={14} height={14} />
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-muted">JPG, PNG, WebP or GIF</p>
              </div>
            </div>

            {avatarMsg && (
              <div
                className={`rounded-lg p-2.5 text-xs ${
                  avatarMsg.type === "success"
                    ? "border border-accent-line bg-accent-soft text-accent"
                    : "border border-danger-line bg-danger-soft text-danger"
                }`}
              >
                {avatarMsg.text}
              </div>
            )}
          </div>

          {/* Profile Details Area (8 cols on lg) */}
          <form id="profile-form" onSubmit={handleUpdateProfile} className="lg:col-span-8 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="user-name">
                  Display Name
                </label>
                <input
                  id="user-name"
                  type="text"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Tom"
                />
              </div>

              <div>
                <label className="label" htmlFor="user-email">
                  Email Address
                </label>
                <input
                  id="user-email"
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {profileMsg && (
              <div
                className={`rounded-lg p-2.5 text-xs ${
                  profileMsg.type === "success"
                    ? "border border-accent-line bg-accent-soft text-accent"
                    : "border border-danger-line bg-danger-soft text-danger"
                }`}
              >
                {profileMsg.text}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                form="profile-form"
                className="btn-primary py-2 px-4 text-xs"
                disabled={profileBusy}
              >
                <IconCheck width={14} height={14} />
                {profileBusy ? "Saving…" : "Save profile"}
              </button>
            </div>
          </form>
        </div>

        {/* Divider & Password Section */}
        <div className="border-t border-line pt-6">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-ink">Change password</h3>
            <p className="text-xs text-muted">Enter your current password and choose a new secure password.</p>
          </div>

          {passwordMsg && (
            <div
              className={`mb-4 rounded-lg p-2.5 text-xs ${
                passwordMsg.type === "success"
                  ? "border border-accent-line bg-accent-soft text-accent"
                  : "border border-danger-line bg-danger-soft text-danger"
              }`}
            >
              {passwordMsg.text}
            </div>
          )}

          <form id="password-form" onSubmit={handleChangePassword} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="current-password">
                  Current Password
                </label>
                <input
                  id="current-password"
                  type="password"
                  className="input"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label" htmlFor="new-password">
                  New Password
                </label>
                <input
                  id="new-password"
                  type="password"
                  className="input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  placeholder="Min 8 characters"
                  required
                />
              </div>

              <div>
                <label className="label" htmlFor="confirm-password">
                  Confirm Password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  className="input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  placeholder="Repeat new password"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                form="password-form"
                className="btn-secondary py-2 px-4 text-xs"
                disabled={passwordBusy}
              >
                <IconLock width={14} height={14} />
                {passwordBusy ? "Updating…" : "Update password"}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Membership & Subscription Card */}
      <section id="subscription" className="card p-6 scroll-mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="display text-lg">Membership & plan</h2>
              {isPro ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-accent">
                  <IconSparkles width={11} height={11} />
                  Pro Active
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-wash px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-muted">
                  Free Tier
                </span>
              )}
            </div>
            <p className="mt-1 text-[13px] text-muted">
              {isPro
                ? `You have unlocked smpl. Pro on a ${user.subscriptionInterval || "monthly"} plan${user.subscriptionRenewsAt ? ` (renews on ${user.subscriptionRenewsAt})` : ""}.`
                : "Free tier covers up to 100 items. Upgrade to Pro to unlock unlimited possessions tracking, full historical charts, and CSV & JSON data exports."}
            </p>
          </div>

          {isPro && (
            <button
              type="button"
              onClick={() => handleSubscribe("free")}
              disabled={subBusy}
              className="text-[12px] text-muted underline hover:text-danger transition-colors"
            >
              Cancel subscription
            </button>
          )}
        </div>

        {subMsg && (
          <div
            className={`mt-4 rounded-lg p-3 text-sm ${
              subMsg.type === "success"
                ? "border border-accent-line bg-accent-soft text-accent"
                : "border border-danger-line bg-danger-soft text-danger"
            }`}
          >
            {subMsg.text}
          </div>
        )}

        {/* Pricing selector */}
        <div className="mt-6 flex items-center justify-center">
          <div className="inline-flex rounded-xl border border-line bg-paper p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setSubInterval("monthly")}
              className={`rounded-lg px-4 py-1.5 text-[13px] font-medium transition-all ${
                subInterval === "monthly"
                  ? "bg-brand text-brand-fg shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              Monthly ($3.49/mo)
            </button>
            <button
              type="button"
              onClick={() => setSubInterval("yearly")}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-[13px] font-medium transition-all ${
                subInterval === "yearly"
                  ? "bg-brand text-brand-fg shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              <span>Yearly ($24.99/yr)</span>
              <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold text-accent">
                Save 40%
              </span>
            </button>
          </div>
        </div>

        {/* Tier Cards Comparison */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Free Tier */}
          <div
            className={`flex flex-col justify-between rounded-xl border p-5 transition-all ${
              !isPro
                ? "border-line-strong bg-paper ring-1 ring-line-strong"
                : "border-line bg-card opacity-80"
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-ink">Free Plan</h3>
                {!isPro && (
                  <span className="rounded bg-wash px-2 py-0.5 text-[11px] font-medium text-muted">
                    Current plan
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="display text-3xl font-semibold text-ink">$0</span>
                <span className="text-xs text-muted">/ forever</span>
              </div>
              <p className="mt-2 text-[12px] text-muted">Essential decluttering & basic item tracking</p>

              <ul className="mt-4 space-y-2 text-[13px] text-ink-soft">
                <li className="flex items-center gap-2">
                  <IconCheck width={14} height={14} className="text-accent shrink-0" />
                  <span>Track up to 100 items</span>
                </li>
                <li className="flex items-center gap-2">
                  <IconCheck width={14} height={14} className="text-accent shrink-0" />
                  <span>Purgatory & staging workflow</span>
                </li>
                <li className="flex items-center gap-2">
                  <IconCheck width={14} height={14} className="text-accent shrink-0" />
                  <span>Core declutter scoring engine</span>
                </li>
                <li className="flex items-center gap-2">
                  <IconCheck width={14} height={14} className="text-accent shrink-0" />
                  <span>Light and Dark mode</span>
                </li>
              </ul>
            </div>

            <div className="mt-6">
              {!isPro ? (
                <button
                  type="button"
                  disabled
                  className="w-full rounded-lg border border-line py-2 text-[13px] font-medium text-muted"
                >
                  Active Plan
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSubscribe("free")}
                  disabled={subBusy}
                  className="w-full rounded-lg border border-line py-2 text-[13px] font-medium text-muted hover:border-danger hover:text-danger transition-colors"
                >
                  {subBusy ? "Updating…" : "Downgrade to Free"}
                </button>
              )}
            </div>
          </div>

          {/* Pro Tier */}
          <div
            className={`flex flex-col justify-between rounded-xl border p-5 transition-all ${
              isPro
                ? "border-accent bg-accent-soft/20 ring-1 ring-accent"
                : "border-accent/40 bg-paper shadow-sm"
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-semibold text-ink">Pro Plan</h3>
                  <IconSparkles width={14} height={14} className="text-accent" />
                </div>
                {isPro ? (
                  <span className="rounded bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent">
                    Active Plan
                  </span>
                ) : (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                    Recommended
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="display text-3xl font-semibold text-ink">
                  {subInterval === "yearly" ? "$24.99" : "$3.49"}
                </span>
                <span className="text-xs text-muted">
                  {subInterval === "yearly" ? "USD / year ($2.08/mo)" : "USD / month"}
                </span>
              </div>
              <p className="mt-2 text-[12px] text-muted">
                Complete possession analytics, unlimited items, and full CSV & JSON data exports
              </p>

              <ul className="mt-4 space-y-2 text-[13px] text-ink-soft">
                <li className="flex items-center gap-2">
                  <IconCheck width={14} height={14} className="text-accent shrink-0" />
                  <strong>Unlimited inventory items & photos</strong>
                </li>
                <li className="flex items-center gap-2">
                  <IconCheck width={14} height={14} className="text-accent shrink-0" />
                  <span>Possessions over time historical charts</span>
                </li>
                <li className="flex items-center gap-2">
                  <IconCheck width={14} height={14} className="text-accent shrink-0" />
                  <span>Quarterly Net Items & sales recovery</span>
                </li>
                <li className="flex items-center gap-2">
                  <IconCheck width={14} height={14} className="text-accent shrink-0" />
                  <strong>Complete CSV & JSON data backups and exports</strong>
                </li>
                <li className="flex items-center gap-2">
                  <IconCheck width={14} height={14} className="text-accent shrink-0" />
                  <span>PRO badge across dashboard and profile</span>
                </li>
              </ul>
            </div>

            <div className="mt-6">
              {isPro ? (
                user.subscriptionInterval !== subInterval ? (
                  <button
                    type="button"
                    onClick={() => handleSubscribe("premium", subInterval)}
                    disabled={subBusy}
                    className="btn-primary w-full"
                  >
                    {subBusy ? "Updating…" : `Switch to ${subInterval === "yearly" ? "Yearly ($24.99/yr)" : "Monthly ($3.49/mo)"}`}
                  </button>
                ) : (
                  <div className="rounded-lg bg-accent-soft py-2 text-center text-[13px] font-semibold text-accent">
                    Active Subscription
                  </div>
                )
              ) : (
                <button
                  type="button"
                  onClick={() => handleSubscribe("premium", subInterval)}
                  disabled={subBusy}
                  className="btn-primary w-full shadow-sm"
                >
                  <IconSparkles width={15} height={15} />
                  {subBusy
                    ? "Upgrading…"
                    : `Upgrade to Pro — ${subInterval === "yearly" ? "$24.99/yr" : "$3.49/mo"}`}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Categories & Subcategories Customization */}
      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="display text-lg">Categories & Subcategories</h2>
            <p className="mt-1 text-[13px] text-muted">
              Customize the categories and subcategories you use to organize your possessions.
            </p>
          </div>
          <form onSubmit={handleAddCategory} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="New category name…"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="input py-1.5 px-3 text-xs h-9 w-48 sm:w-60"
            />
            <button
              type="submit"
              disabled={catBusy || !newCatName.trim()}
              className="btn-primary text-xs h-9 flex items-center gap-1.5 shrink-0"
            >
              <IconPlus width={13} height={13} />
              Add Category
            </button>
          </form>
        </div>

        {catError && (
          <div className="mt-4 rounded-lg border border-danger-line bg-danger-soft p-3 text-sm text-danger">
            {catError}
          </div>
        )}

        <div className="mt-6 space-y-4">
          {categories.length === 0 ? (
            <p className="text-xs text-muted">No categories configured yet.</p>
          ) : (
            categories.map((c) => {
              const isEditing = editingCat === c.category;
              const style = getCategoryStyle(c.category);

              return (
                <div
                  key={c.category}
                  className="rounded-xl border border-line bg-paper p-4 transition-all"
                >
                  {/* Category Header Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            autoFocus
                            value={editCatName}
                            onChange={(e) => setEditCatName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRenameCategory(c.category);
                              if (e.key === "Escape") setEditingCat(null);
                            }}
                            className="input py-1 px-2 text-xs h-8 w-44"
                          />
                          <button
                            type="button"
                            onClick={() => handleRenameCategory(c.category)}
                            disabled={catBusy}
                            className="btn-primary text-xs py-1 px-2.5 h-8"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCat(null)}
                            className="btn-secondary text-xs py-1 px-2.5 h-8"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${style}`}
                          >
                            {formatCategory(c.category)}
                          </span>
                          <span className="text-[11px] text-muted">
                            ({c.subcategories.length}{" "}
                            {c.subcategories.length === 1 ? "subcategory" : "subcategories"})
                          </span>
                        </div>
                      )}
                    </div>

                    {!isEditing && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCat(c.category);
                            setEditCatName(c.category);
                          }}
                          className="text-xs font-medium text-muted hover:text-ink transition-colors cursor-pointer"
                        >
                          Rename
                        </button>
                        <span className="text-line">•</span>
                        <button
                          type="button"
                          onClick={() => setCatToDelete(c.category)}
                          className="text-xs font-medium text-danger/80 hover:text-danger transition-colors cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Subcategories List and Adder */}
                  <div className="mt-3.5 pt-3 border-t border-line-soft">
                    <div className="flex flex-wrap items-center gap-2">
                      {c.subcategories.map((sub) => {
                        const isEditingSub =
                          editingSubcat?.category === c.category && editingSubcat?.oldSub === sub;

                        return (
                          <div
                            key={sub}
                            className="inline-flex items-center rounded-lg border border-line bg-card py-1 px-2 text-xs"
                          >
                            {isEditingSub ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  autoFocus
                                  value={editSubcatName}
                                  onChange={(e) => setEditSubcatName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleRenameSubcategory(c.category, sub);
                                    if (e.key === "Escape") setEditingSubcat(null);
                                  }}
                                  className="input py-0.5 px-1.5 text-xs h-6 w-28"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRenameSubcategory(c.category, sub)}
                                  disabled={catBusy}
                                  className="text-[11px] font-semibold text-accent hover:underline"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingSubcat(null)}
                                  className="text-[11px] text-muted hover:text-ink"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <>
                                <span className="font-medium text-ink">{sub}</span>
                                <div className="ml-2 flex items-center gap-1.5 text-muted/70">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingSubcat({ category: c.category, oldSub: sub });
                                      setEditSubcatName(sub);
                                    }}
                                    className="hover:text-ink transition-colors cursor-pointer text-[10px]"
                                    title="Rename subcategory"
                                  >
                                    ✎
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSubcatToDelete({ category: c.category, sub })
                                    }
                                    className="hover:text-danger transition-colors cursor-pointer text-[10px]"
                                    title="Delete subcategory"
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
                          className="input py-1 px-2 text-xs h-7 w-32 bg-card/60 focus:bg-card"
                        />
                        {(newSubcatNames[c.category] || "").trim() && (
                          <button
                            type="button"
                            onClick={() => handleAddSubcategory(c.category)}
                            disabled={catBusy}
                            className="btn-primary py-0.5 px-2 text-xs h-7"
                          >
                            Add
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Export Data Card — Paywalled for Pro */}
      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="display text-lg">Export data</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent uppercase tracking-wider">
                <IconSparkles width={10} height={10} />
                Pro Feature
              </span>
            </div>
            <p className="mt-1 text-[13px] text-muted">
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
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              <IconLock width={13} height={13} />
              Upgrade to Pro to export
            </button>
          )}
        </div>

        {!isPro && (
          <div className="mt-4 rounded-xl border border-line bg-paper p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-wash text-muted">
                <IconLock width={18} height={18} />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">Data export is locked on the Free tier</p>
                <p className="text-xs text-muted">
                  Upgrade to Pro to download CSV spreadsheets of your active inventory, wishlist, offloaded items, and full JSON database backups anytime.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleSubscribe("premium", subInterval)}
              disabled={subBusy}
              className="btn-secondary text-xs shrink-0"
            >
              Unlock with Pro
            </button>
          </div>
        )}

        <div className={`mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 ${!isPro ? "opacity-60 pointer-events-none select-none" : ""}`}>
          <a
            href={isPro ? "/api/export?type=inventory" : "#"}
            download
            className="flex flex-col rounded-xl border border-line bg-paper p-4 transition hover:border-line-strong hover:shadow-lift"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ink">Inventory CSV</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <IconBox width={15} height={15} />
              </span>
            </div>
            <p className="mt-1 text-[12px] text-muted">Active owned items</p>
            <span className="mt-3 text-[12px] font-medium text-accent hover:underline">
              {isPro ? "Download CSV ↓" : "Locked (Pro)"}
            </span>
          </a>

          <a
            href={isPro ? "/api/export?type=purgatory" : "#"}
            download
            className="flex flex-col rounded-xl border border-line bg-paper p-4 transition hover:border-line-strong hover:shadow-lift"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ink">Purgatory CSV</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-clay-soft text-clay">
                <IconFlame width={15} height={15} />
              </span>
            </div>
            <p className="mt-1 text-[12px] text-muted">Staged for offload</p>
            <span className="mt-3 text-[12px] font-medium text-clay hover:underline">
              {isPro ? "Download CSV ↓" : "Locked (Pro)"}
            </span>
          </a>

          <a
            href={isPro ? "/api/export?type=wishlist" : "#"}
            download
            className="flex flex-col rounded-xl border border-line bg-paper p-4 transition hover:border-line-strong hover:shadow-lift"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ink">Wishlist CSV</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-warn-soft text-warn">
                <IconHeart width={15} height={15} />
              </span>
            </div>
            <p className="mt-1 text-[12px] text-muted">Wishlist items & scores</p>
            <span className="mt-3 text-[12px] font-medium text-warn hover:underline">
              {isPro ? "Download CSV ↓" : "Locked (Pro)"}
            </span>
          </a>

          <a
            href={isPro ? "/api/export?type=offloaded" : "#"}
            download
            className="flex flex-col rounded-xl border border-line bg-paper p-4 transition hover:border-line-strong hover:shadow-lift"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ink">Offloaded CSV</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-wash text-ink-soft">
                <IconArchive width={15} height={15} />
              </span>
            </div>
            <p className="mt-1 text-[12px] text-muted">Disposed, sold & donated</p>
            <span className="mt-3 text-[12px] font-medium text-ink hover:underline">
              {isPro ? "Download CSV ↓" : "Locked (Pro)"}
            </span>
          </a>

          <a
            href={isPro ? "/api/export?type=json" : "#"}
            download
            className="flex flex-col rounded-xl border border-line bg-paper p-4 transition hover:border-line-strong hover:shadow-lift"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ink">JSON Archive</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <IconBox width={15} height={15} />
              </span>
            </div>
            <p className="mt-1 text-[12px] text-muted">Complete raw backup</p>
            <span className="mt-3 text-[12px] font-medium text-brand hover:underline">
              {isPro ? "Download JSON ↓" : "Locked (Pro)"}
            </span>
          </a>
        </div>
      </section>

      {/* Account Footer with Sign Out & Theme Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-card p-4">
        <div className="text-[13px] text-muted">
          Member since: <span className="text-ink font-medium">{user.createdAt?.slice(0, 10) || "—"}</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </div>

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
