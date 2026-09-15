import React, { useState } from "react";
import { resolveAvatarUrl } from "../../api/users";

type AvatarProps = {
  src: string | null | undefined;
  username: string;
  size?: number;
  className?: string;
};

export const Avatar: React.FC<AvatarProps> = ({ src, username, size, className = "" }) => {
  const [failed, setFailed] = useState(false);
  const url = resolveAvatarUrl(src);
  const style = size ? { width: size, height: size, fontSize: Math.round(size / 3) } : undefined;

  if (!url || failed) {
    return (
      <span className={`social-avatar--fallback ${className}`} style={style} aria-hidden="true">
        {username.replace(/^@/, "").slice(0, 2) || "?"}
      </span>
    );
  }

  return (
    <img
      className={`social-avatar ${className}`}
      style={style}
      src={url}
      alt={`Avatar of @${username}`}
      onError={() => setFailed(true)}
    />
  );
};

export default Avatar;
