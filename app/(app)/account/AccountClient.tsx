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
  IconSparkles,
  IconTrash,
} from "@/components/icons";

interface AccountStats {
  totalItems?: number;
  ownedCount?: number;
  purgatoryCount?: number;
  offloadedCount?: number;
  wishlistCount?: number;
}

interface AccountClientProps {
  initialUser: User;
  stats?: AccountStats;
  initialBackup?: unknown;
}

export default function AccountClient({ initialUser }: AccountClientProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<User>(initialUser);
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
          ? `Upgraded to Pro (${targetInterval === "yearly" ? "$29.99/year" : "$3.49/month"})! All Pro features are unlocked.`
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

      {/* 3-Column Profile, Credentials & Security Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
        {/* Profile Picture Card */}
        <section className="card p-6 flex flex-col justify-between">
          <div>
            <h2 className="display text-lg">Profile picture</h2>
            <p className="mt-1 text-[13px] text-muted">
              Your photo appears in the sidebar and top navigation.
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

            <div className="mt-5 flex flex-col items-center sm:items-start gap-4">
              <UserAvatar
                name={user.name}
                email={user.email}
                avatarPath={user.avatarPath}
                size={76}
              />
              <div className="space-y-2 w-full">
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
                    {avatarBusy ? "Uploading…" : "Upload photo"}
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
              </div>
            </div>
          </div>
          <p className="mt-4 text-[11px] text-muted border-t border-line pt-3">
            Supports JPEG, PNG, WebP or GIF up to 10 MB.
          </p>
        </section>

        {/* Display Name and Email Card */}
        <section className="card p-6 flex flex-col justify-between">
          <div>
            <h2 className="display text-lg">Profile information</h2>
            <p className="mt-1 text-[13px] text-muted">
              Update your display name and email address.
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

            <form id="profile-form" onSubmit={handleUpdateProfile} className="mt-5 space-y-4">
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
            </form>
          </div>

          <div className="pt-4 border-t border-line mt-4">
            <button
              type="submit"
              form="profile-form"
              className="btn-primary w-full"
              disabled={profileBusy}
            >
              <IconCheck width={15} height={15} />
              {profileBusy ? "Saving…" : "Save profile"}
            </button>
          </div>
        </section>

        {/* Password & Security Card */}
        <section className="card p-6 flex flex-col justify-between">
          <div>
            <h2 className="display text-lg">Password & security</h2>
            <p className="mt-1 text-[13px] text-muted">
              Change your password to keep your account secure.
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

            <form id="password-form" onSubmit={handleChangePassword} className="mt-5 space-y-3">
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
                  required
                />
              </div>
            </form>
          </div>

          <div className="pt-4 border-t border-line mt-4">
            <button
              type="submit"
              form="password-form"
              className="btn-primary w-full"
              disabled={passwordBusy}
            >
              {passwordBusy ? "Updating…" : "Update password"}
            </button>
          </div>
        </section>
      </div>

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
                  {subInterval === "yearly" ? "$29.99" : "$3.49"}
                </span>
                <span className="text-xs text-muted">
                  {subInterval === "yearly" ? "USD / year ($2.50/mo)" : "USD / month"}
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
                    : `Upgrade to Pro — ${subInterval === "yearly" ? "$29.99/yr" : "$3.49/mo"}`}
                </button>
              )}
            </div>
          </div>
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
    </div>
  );
}
