"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { User } from "@/lib/db";
import { UserAvatar } from "@/components/UserAvatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SignOutButton } from "@/components/SignOutButton";
import {
  IconArrowLeft,
  IconCamera,
  IconCheck,
  IconHeart,
  IconFlame,
  IconBox,
  IconTrash,
} from "@/components/icons";

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
}

export default function AccountClient({ initialUser, stats }: AccountClientProps) {
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
