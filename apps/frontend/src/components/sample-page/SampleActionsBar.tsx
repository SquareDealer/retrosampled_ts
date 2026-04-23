import React from "react";
import { MouseEventHandler } from "react";

export type SampleActionsBarProps = {
  likesCount: number;
  isLiked: boolean;
  onLike: MouseEventHandler<HTMLButtonElement>;
  onAdd: MouseEventHandler<HTMLButtonElement>;
  onDownload: MouseEventHandler<HTMLButtonElement>;
  onCopy: MouseEventHandler<HTMLButtonElement>;
  onMore: MouseEventHandler<HTMLButtonElement>;
  isAddDisabled?: boolean;
};

const formatLikes = (likesCount: number): string => {
  if (likesCount < 1000) {
    return String(likesCount);
  }

  const shortened = likesCount / 1000;
  const value = shortened >= 100 ? Math.round(shortened) : Math.round(shortened * 10) / 10;

  return `${value.toString().replace(/\.0$/, "")}k`;
};

type ActionButtonProps = {
  label: string;
  title: string;
  onClick: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
};

const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  title,
  onClick,
  disabled,
  active,
  children,
}) => {
  return (
    <button
      type="button"
      className={`sample-actions-bar__button${active ? " sample-actions-bar__button--active" : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title}
    >
      {children}
    </button>
  );
};

const LikeIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" className="sample-actions-bar__icon" aria-hidden="true">
    <path
      d="M12 21l-1.4-1.28C5.4 15 2 12 2 8.2 2 5.1 4.4 3 7.3 3c1.8 0 3.5.9 4.7 2.3C13.2 3.9 14.9 3 16.7 3 19.6 3 22 5.1 22 8.2c0 3.8-3.4 6.8-8.6 11.5L12 21z"
      fill="currentColor"
    />
  </svg>
);

const AddIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" className="sample-actions-bar__icon" aria-hidden="true">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const DownloadIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" className="sample-actions-bar__icon" aria-hidden="true">
    <path d="M12 4v10m0 0l4-4m-4 4l-4-4M4 19h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CopyIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" className="sample-actions-bar__icon" aria-hidden="true">
    <rect x="9" y="9" width="10" height="10" rx="2" />
    <path d="M5 15V7c0-1.1.9-2 2-2h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
  </svg>
);

const MoreIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" className="sample-actions-bar__icon" aria-hidden="true">
    <circle cx="5" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="19" cy="12" r="2" />
  </svg>
);

export const SampleActionsBar: React.FC<SampleActionsBarProps> = ({
  likesCount,
  isLiked,
  onLike,
  onAdd,
  onDownload,
  onCopy,
  onMore,
  isAddDisabled,
}) => {
  return (
    <section className="sample-actions-bar" aria-label="Sample actions">
      <span
        className={`sample-actions-bar__likes${isLiked ? " sample-actions-bar__likes--active" : ""}`}
        aria-label={`Likes ${likesCount}`}
      >
        {formatLikes(likesCount)}
      </span>

      <ActionButton label="Like sample" title="Like" onClick={onLike} active={isLiked}>
        <LikeIcon />
      </ActionButton>

      <ActionButton
        label="Add sample"
        title={isAddDisabled ? "Soon" : "Add"}
        onClick={onAdd}
        disabled={isAddDisabled}
      >
        <AddIcon />
      </ActionButton>

      <ActionButton label="Download sample" title="Download" onClick={onDownload}>
        <DownloadIcon />
      </ActionButton>

      <ActionButton label="Copy sample link" title="Copy link" onClick={onCopy}>
        <CopyIcon />
      </ActionButton>

      <ActionButton label="More actions" title="More" onClick={onMore}>
        <MoreIcon />
      </ActionButton>
    </section>
  );
};
