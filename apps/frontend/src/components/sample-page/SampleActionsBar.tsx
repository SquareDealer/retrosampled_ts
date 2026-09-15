import React from "react";
import { MouseEventHandler } from "react";
import { AddIcon, CopyIcon, DownloadIcon, HeartIcon, MoreHorizontalIcon } from "../icons";

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
        <HeartIcon filled={isLiked} className="sample-actions-bar__icon" />
      </ActionButton>

      <ActionButton
        label="Add sample"
        title={isAddDisabled ? "Soon" : "Add"}
        onClick={onAdd}
        disabled={isAddDisabled}
      >
        <AddIcon className="sample-actions-bar__icon" />
      </ActionButton>

      <ActionButton label="Download sample" title="Download" onClick={onDownload}>
        <DownloadIcon className="sample-actions-bar__icon" />
      </ActionButton>

      <ActionButton label="Copy sample link" title="Copy link" onClick={onCopy}>
        <CopyIcon className="sample-actions-bar__icon" />
      </ActionButton>

      <ActionButton label="More actions" title="More" onClick={onMore}>
        <MoreHorizontalIcon className="sample-actions-bar__icon" />
      </ActionButton>
    </section>
  );
};
