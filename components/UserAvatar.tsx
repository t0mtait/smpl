"use client";

import { useState } from "react";

interface UserAvatarProps {
  name?: string | null;
  email?: string | null;
  avatarPath?: string | null;
  size?: number;
  className?: string;
}

export function UserAvatar({
  name,
  email,
  avatarPath,
  size = 36,
  className = "",
}: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);

  const displayName = name?.trim() || email?.trim() || "User";
  const initial = (name?.trim() ? name.trim()[0] : email?.trim() ? email.trim()[0] : "U").toUpperCase();

  const src = avatarPath
    ? avatarPath.startsWith("/") || avatarPath.startsWith("http")
      ? avatarPath
      : `/api/photos/${avatarPath}`
    : null;

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={displayName}
        width={size}
        height={size}
        onError={() => setImgError(true)}
        className={`shrink-0 rounded-full object-cover ring-1 ring-line ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`shrink-0 flex items-center justify-center rounded-full font-semibold uppercase tracking-wider bg-brand text-brand-fg shadow-sm ring-1 ring-line ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, Math.round(size * 0.4)),
      }}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}
