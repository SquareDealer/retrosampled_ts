import React, { useMemo, useState } from "react";
import { CommentsSortOption, SampleComment } from "../../types/sampleDetail";
import { formatTimeAgo } from "../../utils/formatTimeAgo";

const MAX_COMMENT_LENGTH = 500;

const SORT_LABELS: Record<CommentsSortOption, string> = {
  newest: "Newest",
  oldest: "Oldest",
  "most-liked": "Most liked",
};

type CommentsSectionProps = {
  comments: SampleComment[];
  totalCount: number;
  onAddComment: (text: string) => Promise<void> | void;
  onReply: (parentId: string, text: string) => Promise<void> | void;
  isLoading?: boolean;
  errorText?: string | null;
  onRetry?: () => void;
  onProfileOpen?: (userId: string) => void;
};

type CommentInputProps = {
  placeholder: string;
  submitLabel: string;
  isLoading?: boolean;
  maxLength?: number;
  onSubmit: (text: string) => Promise<void>;
};

const normalizeText = (text: string): string => {
  return text.trim();
};

const sortComments = (comments: SampleComment[], sortBy: CommentsSortOption): SampleComment[] => {
  const copied = comments.map((comment) => ({
    ...comment,
    replies: [...(comment.replies ?? [])].sort((replyA, replyB) => {
      return new Date(replyA.createdAt).getTime() - new Date(replyB.createdAt).getTime();
    }),
  }));

  const byNewest = (left: SampleComment, right: SampleComment) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  };

  const byOldest = (left: SampleComment, right: SampleComment) => {
    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  };

  if (sortBy === "oldest") {
    return copied.sort(byOldest);
  }

  if (sortBy === "most-liked") {
    return copied.sort((left, right) => {
      const leftScore = left.replies?.length ?? 0;
      const rightScore = right.replies?.length ?? 0;

      if (leftScore !== rightScore) {
        return rightScore - leftScore;
      }

      return byNewest(left, right);
    });
  }

  return copied.sort(byNewest);
};

const getInitials = (username: string): string => {
  const clean = username.replace(/^@/, "").trim();
  if (!clean) {
    return "?";
  }

  return clean.slice(0, 2).toUpperCase();
};

const CommentInput: React.FC<CommentInputProps> = ({
  placeholder,
  submitLabel,
  isLoading = false,
  maxLength = MAX_COMMENT_LENGTH,
  onSubmit,
}) => {
  const [text, setText] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmed = normalizeText(text);
  const isEmpty = trimmed.length === 0;
  const isLimitExceeded = text.length > maxLength;
  const isDisabled = isLoading || isSubmitting || isEmpty || isLimitExceeded;

  const handleSubmit = async () => {
    if (isDisabled) {
      return;
    }

    setErrorText(null);
    setIsSubmitting(true);

    try {
      await onSubmit(trimmed);
      setText("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send comment.";
      setErrorText(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="comments-input">
      <textarea
        className="comments-input__textarea"
        placeholder={placeholder}
        value={text}
        maxLength={maxLength + 1}
        onChange={(event) => setText(event.target.value)}
        disabled={isLoading || isSubmitting}
      />

      <div className="comments-input__footer">
        <span className="comments-input__counter" aria-live="polite">
          {Math.min(text.length, maxLength)}/{maxLength}
        </span>

        <button
          type="button"
          className="comments-input__submit"
          disabled={isDisabled}
          onClick={() => {
            void handleSubmit();
          }}
        >
          {isSubmitting ? "Posting..." : submitLabel}
        </button>
      </div>

      {isLimitExceeded ? <p className="comments-input__error">Comment is too long.</p> : null}
      {errorText ? <p className="comments-input__error">{errorText}</p> : null}
    </div>
  );
};

type CommentUserMetaProps = {
  userId: string;
  username: string;
  createdAt: string;
  avatarUrl?: string;
  isCompact?: boolean;
  onProfileOpen?: (userId: string) => void;
};

const CommentUserMeta: React.FC<CommentUserMetaProps> = ({
  userId,
  username,
  createdAt,
  avatarUrl,
  isCompact = false,
  onProfileOpen,
}) => {
  const handleOpenProfile = () => {
    onProfileOpen?.(userId);
  };

  return (
    <div className={`comments-user${isCompact ? " comments-user--compact" : ""}`}>
      <button
        type="button"
        className="comments-user__avatar-btn"
        onClick={handleOpenProfile}
        aria-label={`Open profile @${username}`}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={`Avatar of @${username}`} className="comments-user__avatar" />
        ) : (
          <span className="comments-user__avatar comments-user__avatar--fallback" aria-hidden="true">
            {getInitials(username)}
          </span>
        )}
      </button>

      <div className="comments-user__content">
        <div className="comments-user__meta">
          <button
            type="button"
            className="comments-user__name"
            onClick={handleOpenProfile}
            aria-label={`Open profile @${username}`}
          >
            @{username}
          </button>
          <span className="comments-user__time">&middot; {formatTimeAgo(createdAt)}</span>
        </div>
      </div>
    </div>
  );
};

type ReplyComposerProps = {
  isOpen: boolean;
  isSubmitting: boolean;
  value: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  errorText?: string | null;
};

const ReplyComposer: React.FC<ReplyComposerProps> = ({
  isOpen,
  isSubmitting,
  value,
  onChange,
  onCancel,
  onSubmit,
  errorText,
}) => {
  if (!isOpen) {
    return null;
  }

  const trimmed = normalizeText(value);
  const isDisabled = isSubmitting || trimmed.length === 0 || value.length > MAX_COMMENT_LENGTH;

  return (
    <div className="comments-reply-composer">
      <textarea
        className="comments-reply-composer__textarea"
        placeholder="Write a reply"
        value={value}
        maxLength={MAX_COMMENT_LENGTH + 1}
        onChange={(event) => onChange(event.target.value)}
        disabled={isSubmitting}
      />

      <div className="comments-reply-composer__actions">
        <button
          type="button"
          className="comments-reply-composer__cancel"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </button>

        <button
          type="button"
          className="comments-reply-composer__submit"
          onClick={onSubmit}
          disabled={isDisabled}
        >
          {isSubmitting ? "Posting..." : "Post"}
        </button>
      </div>

      {value.length > MAX_COMMENT_LENGTH ? (
        <p className="comments-input__error">Reply is too long.</p>
      ) : null}
      {errorText ? <p className="comments-input__error">{errorText}</p> : null}
    </div>
  );
};

type CommentItemProps = {
  comment: SampleComment;
  activeReplyCommentId: string | null;
  replyText: string;
  isReplySubmitting: boolean;
  replyErrorText?: string | null;
  onReplyToggle: (commentId: string) => void;
  onReplyTextChange: (text: string) => void;
  onReplySubmit: (parentId: string) => void;
  onProfileOpen?: (userId: string) => void;
};

const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  activeReplyCommentId,
  replyText,
  isReplySubmitting,
  replyErrorText,
  onReplyToggle,
  onReplyTextChange,
  onReplySubmit,
  onProfileOpen,
}) => {
  const isReplyOpen = activeReplyCommentId === comment.id;

  return (
    <article className="comments-item">
      <CommentUserMeta
        userId={comment.user.id}
        username={comment.user.username}
        createdAt={comment.createdAt}
        avatarUrl={comment.user.avatarUrl}
        onProfileOpen={onProfileOpen}
      />

      <p className="comments-item__text">{comment.text}</p>

      <button
        type="button"
        className="comments-item__reply"
        onClick={() => onReplyToggle(comment.id)}
      >
        reply
      </button>

      <ReplyComposer
        isOpen={isReplyOpen}
        isSubmitting={isReplySubmitting}
        value={isReplyOpen ? replyText : ""}
        onChange={onReplyTextChange}
        onCancel={() => onReplyToggle(comment.id)}
        onSubmit={() => onReplySubmit(comment.id)}
        errorText={isReplyOpen ? replyErrorText : null}
      />

      {comment.replies && comment.replies.length > 0 ? (
        <div className="comments-replies">
          {comment.replies.map((reply) => (
            <div className="comments-reply" key={reply.id}>
              <CommentUserMeta
                userId={reply.user.id}
                username={reply.user.username}
                createdAt={reply.createdAt}
                avatarUrl={reply.user.avatarUrl}
                isCompact
                onProfileOpen={onProfileOpen}
              />
              <p className="comments-reply__text">{reply.text}</p>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
};

const CommentsSkeleton: React.FC = () => {
  return (
    <div className="comments-skeleton" aria-hidden="true">
      {[0, 1, 2].map((item) => (
        <div className="comments-skeleton__item" key={item}>
          <div className="comments-skeleton__avatar" />
          <div className="comments-skeleton__content">
            <div className="comments-skeleton__line comments-skeleton__line--short" />
            <div className="comments-skeleton__line" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const CommentsSection: React.FC<CommentsSectionProps> = ({
  comments,
  totalCount,
  onAddComment,
  onReply,
  isLoading = false,
  errorText,
  onRetry,
  onProfileOpen,
}) => {
  const [sortBy, setSortBy] = useState<CommentsSortOption>("newest");
  const [activeReplyCommentId, setActiveReplyCommentId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyErrorText, setReplyErrorText] = useState<string | null>(null);
  const [isReplySubmitting, setIsReplySubmitting] = useState(false);

  const sortedComments = useMemo(() => sortComments(comments, sortBy), [comments, sortBy]);

  const handleAddComment = async (text: string) => {
    await Promise.resolve(onAddComment(text));
  };

  const toggleReply = (commentId: string) => {
    setReplyErrorText(null);

    setActiveReplyCommentId((current) => {
      if (current === commentId) {
        setReplyText("");
        return null;
      }

      setReplyText("");
      return commentId;
    });
  };

  const handleReplySubmit = async (parentId: string) => {
    const normalizedText = normalizeText(replyText);
    if (!normalizedText || normalizedText.length > MAX_COMMENT_LENGTH) {
      return;
    }

    setReplyErrorText(null);
    setIsReplySubmitting(true);

    try {
      await Promise.resolve(onReply(parentId, normalizedText));
      setReplyText("");
      setActiveReplyCommentId(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send reply.";
      setReplyErrorText(message);
    } finally {
      setIsReplySubmitting(false);
    }
  };

  return (
    <section className="comments" aria-label="Comments">
      <div className="comments__header">
        <h2 className="comments__title">{totalCount} Comments</h2>

        <label className="comments__sort" aria-label="Sort comments">
          <span className="comments__sort-label">Sorted by</span>
          <select
            className="comments__sort-select"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as CommentsSortOption)}
            disabled={isLoading}
          >
            <option value="newest">{SORT_LABELS.newest}</option>
            <option value="oldest">{SORT_LABELS.oldest}</option>
            <option value="most-liked">{SORT_LABELS["most-liked"]}</option>
          </select>
        </label>
      </div>

      <CommentInput
        placeholder="Write a comment"
        submitLabel="Post"
        isLoading={isLoading}
        onSubmit={handleAddComment}
      />

      {isLoading ? <CommentsSkeleton /> : null}

      {!isLoading && errorText ? (
        <div className="comments__state comments__state--error" role="alert">
          <p>{errorText}</p>
          {onRetry ? (
            <button type="button" className="comments__retry" onClick={onRetry}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {!isLoading && !errorText && sortedComments.length === 0 ? (
        <div className="comments__state comments__state--empty">
          <p>No comments yet</p>
          <p>Be the first to comment</p>
        </div>
      ) : null}

      {!isLoading && !errorText && sortedComments.length > 0 ? (
        <div className="comments__list">
          {sortedComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              activeReplyCommentId={activeReplyCommentId}
              replyText={replyText}
              isReplySubmitting={isReplySubmitting && activeReplyCommentId === comment.id}
              replyErrorText={replyErrorText}
              onReplyToggle={toggleReply}
              onReplyTextChange={setReplyText}
              onReplySubmit={handleReplySubmit}
              onProfileOpen={onProfileOpen}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
};
