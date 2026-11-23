"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { User } from "@/lib/db";
import { UserAvatar } from "@/components/UserAvatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SignOutButton } from "@/components/SignOutButton";
import {
  IconArchive,
  IconArrowLeft,
  IconBox,
  IconCamera,
  IconCheck,
  IconCloud,
  IconDatabase,
  IconFlame,
  IconHeart,
  IconSparkles,
  IconTrash,
} from "@/components/icons";
import type { BackupStatus } from "@/lib/backup";

interface AccountStats {
  totalItems: number;
  ownedCount: number;
  purgatoryCount: number;
  offloadedCount: number;
  wishlistCount: number;
}

interface AccountClientProps {
  initialUser: User;
  stats: AccountStats;
  initialBackup?: BackupStatus;
}

export default function AccountClient({ initialUser, stats, initialBackup }: AccountClientProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<User>(initialUser);
  const [name, setName] = useState(initialUser.name || "");
  const [email, setEmail] = useState(initialUser.email || "");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [avatarBusy, setAvatarBusy] = useState(false);
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

  const [backupStatus, setBackupStatus] = useState<BackupStatus | undefined>(initialBackup);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMsg, setBackupMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleManualBackup = async () => {
    setBackupBusy(true);
    setBackupMsg(null);
    try {
      const res = await fetch("/api/backup", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Backup failed");
      }
      const data = await res.json();
      setBackupStatus((prev) => ({
        configured: prev?.configured ?? true,
        bucket: prev?.bucket || "Cloudflare R2",
        lastBackupTime: data.timestamp,
        lastStatus: "success",
        lastError: null,
        sqliteSize: data.sqliteSize,
        jsonSize: data.jsonSize,
        counts: data.counts,
      }));
      setBackupMsg({
        type: "success",
        text: data.uploadedToCloud
          ? `Successfully backed up database snapshot and JSON data archive to Cloudflare R2! (${Math.round(((data.sqliteSize || 0) + (data.jsonSize || 0)) / 1024)} KB total)`
          : `Local backup snapshot created (${Math.round(((data.sqliteSize || 0) + (data.jsonSize || 0)) / 1024)} KB). Note: Cloudflare R2 environment variables are not configured.`,
      });
    } catch (err: unknown) {
      setBackupMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to run backup",
      });
    } finally {
      setBackupBusy(false);
    }
  };

  const handleSubscribe = async (targetPlan: "free" | "premium", targetInterval: "monthly" | "yearly" = subInterval) => {
    setSubBusy(true);
    setSubMsg(null);
    try {
      const res = await fetch("/api/user/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: targetPlan, interval: targetInterval }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update subscription");
      }
      const data = await res.json();
      setUser(data.user);
      if (data.user.subscriptionInterval) {
        setSubInterval(data.user.subscriptionInterval);
      }
      setSubMsg({
        type: "success",
        text: targetPlan === "premium"
          ? `Upgraded to Premium (${targetInterval === "yearly" ? "$29.99/year" : "$3.49/month"})! All premium features are unlocked.`
          : "Subscription cancelled. Your account has returned to the Free tier.",
      });
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
        throw new Error(data.error || "Failed to upload avatar");
      }

      const data = await res.json();
      setUser(data.user);
      setAvatarMsg({ type: "success", text: "Profile picture updated!" });
      router.refresh();
    } catch (err: unknown) {
      setAvatarMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to upload profile picture",
      });
    } finally {
      setAvatarBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    if (!confirm("Remove your profile picture?")) return;
    setAvatarBusy(true);
    setAvatarMsg(null);

    try {
      const res = await fetch("/api/user/avatar", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove avatar");
      const data = await res.json();
      setUser(data.user);
      setAvatarMsg({ type: "success", text: "Profile picture removed." });
      router.refresh();
    } catch (err: unknown) {
      setAvatarMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to remove avatar",
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

      {/* Profile Picture Card */}
      <section className="card p-6">
        <h2 className="display text-lg">Profile picture</h2>
        <p className="mt-1 text-[13px] text-muted">
          Your photo appears next to your name and email in the sidebar and top navigation.
        </p>

        {avatarMsg && (
          <div
            className={`mt-4 rounded-lg p-3 text-sm ${
              avatarMsg.type === "success"
                ? "border border-accent-line bg-accent-soft text-accent"
                : "border border-danger-line bg-danger-soft text-danger"
            }`}
          >
            {avatarMsg.text}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-5">
          <UserAvatar
            name={user.name}
            email={user.email}
            avatarPath={user.avatarPath}
            size={72}
          />
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                id="avatar-upload-input"
              />
              <label
                htmlFor="avatar-upload-input"
                className={`btn-secondary cursor-pointer ${avatarBusy ? "opacity-50 pointer-events-none" : ""}`}
              >
                <IconCamera width={15} height={15} />
                {avatarBusy ? "Uploading…" : "Upload new photo"}
              </label>

              {user.avatarPath ? (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={avatarBusy}
                  className="btn-secondary text-danger hover:border-danger-line"
                >
                  <IconTrash width={15} height={15} />
                  Remove
                </button>
              ) : null}
            </div>
            <p className="text-[11px] text-muted">Supports JPEG, PNG, WebP or GIF up to 10 MB.</p>
          </div>
        </div>
      </section>

      {/* Membership & Subscription Card */}
      <section id="subscription" className="card p-6 scroll-mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="display text-lg">Membership & plan</h2>
              {user.plan === "premium" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-accent">
                  <IconSparkles width={11} height={11} />
                  Premium Active
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-wash px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-muted">
                  Free Tier
                </span>
              )}
            </div>
            <p className="mt-1 text-[13px] text-muted">
              {user.plan === "premium"
                ? `You have unlocked smpl. Premium on a ${user.subscriptionInterval || "monthly"} plan${user.subscriptionRenewsAt ? ` (renews on ${user.subscriptionRenewsAt})` : ""}.`
                : "Free tier covers up to 50 items. Upgrade to unlock unlimited possessions tracking, full historical charts, and CSV data exports."}
            </p>
          </div>

          {user.plan === "premium" && (
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
              <span>Yearly ($29.99/yr)</span>
              <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold text-accent">
                Save 28%
              </span>
            </button>
          </div>
        </div>

        {/* Tier Cards Comparison */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Free Tier */}
          <div
            className={`flex flex-col justify-between rounded-xl border p-5 transition-all ${
              user.plan === "free"
                ? "border-line-strong bg-paper ring-1 ring-line-strong"
                : "border-line bg-card opacity-80"
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-ink">Free Plan</h3>
                {user.plan === "free" && (
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
                  <span>Track up to 50 items</span>
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
              {user.plan === "free" ? (
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

          {/* Premium Tier */}
          <div
            className={`flex flex-col justify-between rounded-xl border p-5 transition-all ${
              user.plan === "premium"
                ? "border-accent bg-accent-soft/20 ring-1 ring-accent"
                : "border-accent/40 bg-paper shadow-sm"
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-semibold text-ink">Premium Plan</h3>
                  <IconSparkles width={14} height={14} className="text-accent" />
                </div>
                {user.plan === "premium" ? (
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
                  {subInterval === "yearly" ? "$29.99" : "$3.49"}
                </span>
                <span className="text-xs text-muted">
                  {subInterval === "yearly" ? "USD / year ($2.50/mo)" : "USD / month"}
                </span>
              </div>
              <p className="mt-2 text-[12px] text-muted">
                Complete possession analytics, unlimited items, and full data export
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
                  <span>Full CSV exports (Inventory, Purgatory, Wishlist, Offloaded)</span>
                </li>
                <li className="flex items-center gap-2">
                  <IconCheck width={14} height={14} className="text-accent shrink-0" />
                  <span>Premium PRO badge across dashboard and profile</span>
                </li>
              </ul>
            </div>

            <div className="mt-6">
              {user.plan === "premium" ? (
                user.subscriptionInterval !== subInterval ? (
                  <button
                    type="button"
                    onClick={() => handleSubscribe("premium", subInterval)}
                    disabled={subBusy}
                    className="btn-primary w-full"
                  >
                    {subBusy ? "Updating…" : `Switch to ${subInterval === "yearly" ? "Yearly ($29.99/yr)" : "Monthly ($3.49/mo)"}`}
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
                    : `Upgrade to Premium — ${subInterval === "yearly" ? "$29.99/yr" : "$3.49/mo"}`}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Profile Details Card */}
      <section className="card p-6">
        <h2 className="display text-lg">Profile information</h2>
        <p className="mt-1 text-[13px] text-muted">
          Update the display name and email address associated with your account.
        </p>

        {profileMsg && (
          <div
            className={`mt-4 rounded-lg p-3 text-sm ${
              profileMsg.type === "success"
                ? "border border-accent-line bg-accent-soft text-accent"
                : "border border-danger-line bg-danger-soft text-danger"
            }`}
          >
            {profileMsg.text}
          </div>
        )}

        <form onSubmit={handleUpdateProfile} className="mt-5 space-y-4 max-w-lg">
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

          <button type="submit" className="btn-primary" disabled={profileBusy}>
            <IconCheck width={15} height={15} />
            {profileBusy ? "Saving…" : "Save profile"}
          </button>
        </form>
      </section>

      {/* Security / Password Card */}
      <section className="card p-6">
        <h2 className="display text-lg">Password & security</h2>
        <p className="mt-1 text-[13px] text-muted">
          Change your account password to keep your inventory secure.
        </p>

        {passwordMsg && (
          <div
            className={`mt-4 rounded-lg p-3 text-sm ${
              passwordMsg.type === "success"
                ? "border border-accent-line bg-accent-soft text-accent"
                : "border border-danger-line bg-danger-soft text-danger"
            }`}
          >
            {passwordMsg.text}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="mt-5 space-y-4 max-w-lg">
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
              required
            />
            <p className="mt-1 text-[11px] text-muted">Minimum 8 characters.</p>
          </div>

          <div>
            <label className="label" htmlFor="confirm-password">
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              type="password"
              className="input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={passwordBusy}>
            {passwordBusy ? "Updating…" : "Update password"}
          </button>
        </form>
      </section>

      {/* Export Data Card */}
      <section className="card p-6">
        <h2 className="display text-lg">Export data</h2>
        <p className="mt-1 text-[13px] text-muted">
          Download your smpl. data as CSV spreadsheets anytime.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <a
            href="/api/export?type=inventory"
            download
            className="flex flex-col rounded-xl border border-line bg-paper p-4 transition hover:border-line-strong hover:shadow-lift"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ink">Inventory CSV</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <IconBox width={15} height={15} />
              </span>
            </div>
            <p className="mt-1 text-[12px] text-muted">All active owned items</p>
            <span className="mt-3 text-[12px] font-medium text-accent hover:underline">
              Download CSV ↓
            </span>
          </a>

          <a
            href="/api/export?type=purgatory"
            download
            className="flex flex-col rounded-xl border border-line bg-paper p-4 transition hover:border-line-strong hover:shadow-lift"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ink">Purgatory CSV</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-clay-soft text-clay">
                <IconFlame width={15} height={15} />
              </span>
            </div>
            <p className="mt-1 text-[12px] text-muted">Items staged for offload</p>
            <span className="mt-3 text-[12px] font-medium text-clay hover:underline">
              Download CSV ↓
            </span>
          </a>

          <a
            href="/api/export?type=wishlist"
            download
            className="flex flex-col rounded-xl border border-line bg-paper p-4 transition hover:border-line-strong hover:shadow-lift"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ink">Wishlist CSV</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-warn-soft text-warn">
                <IconHeart width={15} height={15} />
              </span>
            </div>
            <p className="mt-1 text-[12px] text-muted">Aspirational purchases</p>
            <span className="mt-3 text-[12px] font-medium text-warn hover:underline">
              Download CSV ↓
            </span>
          </a>

          <a
            href="/api/export?type=offloaded"
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
              Download CSV ↓
            </span>
          </a>
        </div>
      </section>

      {/* Cloudflare R2 Cloud Backup */}
      <section className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="display text-lg">Cloudflare R2 Backups</h2>
              {backupStatus?.configured ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-accent">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                  Connected ({backupStatus.bucket || "R2 Bucket"})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-wash px-2.5 py-0.5 text-[11px] font-medium text-muted">
                  Local Only (R2 Not Configured)
                </span>
              )}
            </div>
            <p className="mt-1 text-[13px] text-muted">
              Automatic, continuous off-site snapshots of your SQLite database and complete JSON data archive to Cloudflare R2.
            </p>
          </div>

          <button
            type="button"
            onClick={handleManualBackup}
            disabled={backupBusy}
            className="btn-secondary self-start sm:self-auto shrink-0 flex items-center gap-2 text-[13px]"
          >
            <IconCloud width={16} height={16} />
            {backupBusy ? "Backing up…" : "Backup to Cloudflare now"}
          </button>
        </div>

        {backupMsg && (
          <div
            className={`mt-4 rounded-lg p-3 text-[13px] ${
              backupMsg.type === "success"
                ? "border border-accent-soft bg-accent-soft/40 text-accent"
                : "border border-clay-soft bg-clay-soft/40 text-clay"
            }`}
          >
            {backupMsg.text}
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-line pt-4">
          <div className="rounded-xl border border-line bg-paper p-3">
            <span className="eyebrow flex items-center gap-1">
              <IconCloud width={13} height={13} />
              Last Cloud Backup
            </span>
            <div className="mt-1 text-[13px] font-medium text-ink tabular">
              {backupStatus?.lastBackupTime
                ? new Date(backupStatus.lastBackupTime).toLocaleString()
                : "No cloud backup yet"}
            </div>
          </div>
          <div className="rounded-xl border border-line bg-paper p-3">
            <span className="eyebrow flex items-center gap-1">
              <IconDatabase width={13} height={13} />
              Database Snapshot
            </span>
            <div className="mt-1 text-[13px] font-medium text-ink tabular">
              {backupStatus?.sqliteSize
                ? `${(backupStatus.sqliteSize / 1024).toFixed(1)} KB (.sqlite)`
                : "Pending snapshot"}
            </div>
          </div>
          <div className="rounded-xl border border-line bg-paper p-3">
            <span className="eyebrow flex items-center gap-1">
              <IconBox width={13} height={13} />
              JSON Data Archive
            </span>
            <div className="mt-1 text-[13px] font-medium text-ink tabular">
              {backupStatus?.jsonSize
                ? `${(backupStatus.jsonSize / 1024).toFixed(1)} KB (.json)`
                : "Pending archive"}
            </div>
          </div>
        </div>

        {!backupStatus?.configured && (
          <p className="mt-4 text-[12px] text-muted border-t border-line pt-3">
            💡 Tip: To enable cloud sync to Cloudflare R2, set <code className="rounded bg-wash px-1.5 py-0.5 text-ink font-mono text-[11px]">R2_BUCKET</code>, <code className="rounded bg-wash px-1.5 py-0.5 text-ink font-mono text-[11px]">R2_ENDPOINT</code>, <code className="rounded bg-wash px-1.5 py-0.5 text-ink font-mono text-[11px]">R2_ACCESS_KEY_ID</code>, and <code className="rounded bg-wash px-1.5 py-0.5 text-ink font-mono text-[11px]">R2_SECRET_ACCESS_KEY</code> in your environment.
          </p>
        )}
      </section>

      {/* Account Overview Stats */}
      <section className="card p-6">
        <h2 className="display text-lg">Account overview</h2>
        <p className="mt-1 text-[13px] text-muted">Summary of activity on smpl.</p>

        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-line bg-paper p-4">
            <span className="eyebrow flex items-center gap-1.5">
              <IconBox width={13} height={13} />
              Owned
            </span>
            <div className="mt-2 text-2xl font-semibold tabular text-ink">{stats.ownedCount}</div>
          </div>

          <div className="rounded-xl border border-line bg-paper p-4">
            <span className="eyebrow flex items-center gap-1.5">
              <IconFlame width={13} height={13} />
              Purgatory
            </span>
            <div className="mt-2 text-2xl font-semibold tabular text-ink">{stats.purgatoryCount}</div>
          </div>

          <div className="rounded-xl border border-line bg-paper p-4">
            <span className="eyebrow flex items-center gap-1.5">
              <IconHeart width={13} height={13} />
              Wishlist
            </span>
            <div className="mt-2 text-2xl font-semibold tabular text-ink">{stats.wishlistCount}</div>
          </div>

          <div className="rounded-xl border border-line bg-paper p-4">
            <span className="eyebrow">Offloaded</span>
            <div className="mt-2 text-2xl font-semibold tabular text-ink">{stats.offloadedCount}</div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
          <div className="text-[13px] text-muted">
            Account created: <span className="text-ink">{user.createdAt?.slice(0, 10) || "—"}</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </section>
    </div>
  );
}
