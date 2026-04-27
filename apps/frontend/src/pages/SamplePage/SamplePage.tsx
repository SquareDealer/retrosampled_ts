import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  fetchSampleById,
  fetchSampleComments,
  mockCreateCommentRequest,
  mockToggleCreatorFollowRequest,
  mockToggleLikeRequest,
} from "../../api/samples";
import { CommentsSection } from "../../components/sample-page/CommentsSection";
import { SampleActionsBar } from "../../components/sample-page/SampleActionsBar";
import { SampleCoverCard } from "../../components/sample-page/SampleCoverCard";
import { CreatorsSection } from "../../components/sample-page/CreatorsSection";
import { SampleHeader } from "../../components/sample-page/SampleHeader";
import { SampleMeta } from "../../components/sample-page/SampleMeta";
import { SamplePlayer } from "../../components/sample-page/SamplePlayer";
import { RelatedSamplesSection } from "../../components/sample-page/RelatedSamplesSection";
import { SampleTags } from "../../components/sample-page/SampleTags";
import { SampleComment, SampleDetail } from "../../types/sampleDetail";
import "./SamplePage.css";

type PageStatus = "loading" | "loaded" | "error" | "empty";

type NoticeState = {
  tone: "success" | "error";
  text: string;
};

type CommentsStatus = "loading" | "loaded" | "error";

const LOCAL_COMMENT_USER = {
  id: "u2",
  username: "squaredealer",
  avatarUrl: "/img/avatar.jpg",
};

const NOTICE_DURATION_MS = 1800;

const buildSamplePageUrl = (sampleId: string): string => {
  return `${window.location.origin}/sample/${sampleId}`;
};

const downloadSample = (url: string, title: string) => {
  const link = document.createElement("a");
  const safeTitle = title.trim().replace(/\s+/g, "-").toLowerCase();

  link.href = url;
  link.download = `${safeTitle || "sample"}.wav`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const copyText = async (value: string): Promise<void> => {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const temporaryInput = document.createElement("textarea");
  temporaryInput.value = value;
  temporaryInput.setAttribute("readonly", "true");
  temporaryInput.style.position = "absolute";
  temporaryInput.style.left = "-9999px";

  document.body.appendChild(temporaryInput);
  temporaryInput.select();
  document.execCommand("copy");
  document.body.removeChild(temporaryInput);
};

const SamplePageSkeleton: React.FC = () => {
  return (
    <div className="sample-page sample-page--loading" aria-busy="true">
      <div className="sample-page__inner">
        <div className="sample-page__left">
          <div className="sample-page__skeleton sample-page__skeleton--cover" />
          <div className="sample-page__skeleton sample-page__skeleton--actions" />
        </div>

        <div className="sample-page__right">
          <div className="sample-page__skeleton sample-page__skeleton--title" />
          <div className="sample-page__skeleton sample-page__skeleton--subtitle" />
          <div className="sample-page__skeleton sample-page__skeleton--meta" />
          <div className="sample-page__skeleton sample-page__skeleton--tags" />
          <div className="sample-page__skeleton sample-page__skeleton--player" />
        </div>
      </div>
    </div>
  );
};

const SamplePage: React.FC = () => {
  const { sampleId = "" } = useParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState<PageStatus>("loading");
  const [sample, setSample] = useState<SampleDetail | null>(null);
  const [errorText, setErrorText] = useState<string>("Failed to load sample.");
  const [reloadToken, setReloadToken] = useState(0);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [comments, setComments] = useState<SampleComment[]>([]);
  const [commentsStatus, setCommentsStatus] = useState<CommentsStatus>("loading");
  const [commentsErrorText, setCommentsErrorText] = useState<string | null>(null);
  const [creatorFollowById, setCreatorFollowById] = useState<Record<string, boolean>>({});
  const [creatorFollowLoadingById, setCreatorFollowLoadingById] = useState<
    Record<string, boolean>
  >({});

  const menuRef = useRef<HTMLDivElement | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  const creatorsWithFollowState = useMemo(() => {
    if (!sample) {
      return [];
    }

    return sample.creators.map((creator) => ({
      ...creator,
      isFollowing: creatorFollowById[creator.id] ?? creator.isFollowing,
    }));
  }, [creatorFollowById, sample]);

  const loadingCreatorIds = useMemo(() => {
    return Object.entries(creatorFollowLoadingById)
      .filter(([, isLoading]) => isLoading)
      .map(([creatorId]) => creatorId);
  }, [creatorFollowLoadingById]);

  const totalCommentsCount = useMemo(() => {
    return comments.reduce((sum, comment) => {
      return sum + 1 + (comment.replies?.length ?? 0);
    }, 0);
  }, [comments]);

  const showNotice = (tone: NoticeState["tone"], text: string) => {
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }

    setNotice({ tone, text });
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimerRef.current = null;
    }, NOTICE_DURATION_MS);
  };

  useEffect(() => {
    let cancelled = false;

    const loadSample = async () => {
      setStatus("loading");
      setErrorText("Failed to load sample.");
      setSample(null);

      try {
        const loadedSample = await fetchSampleById(sampleId);

        if (cancelled) {
          return;
        }

        if (!loadedSample) {
          setStatus("empty");
          return;
        }

        setSample(loadedSample);
        setStatus("loaded");
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : "Failed to load sample.";
        setErrorText(message);
        setStatus("error");
      }
    };

    void loadSample();

    return () => {
      cancelled = true;
    };
  }, [sampleId, reloadToken]);

  useEffect(() => {
    let cancelled = false;

    const loadComments = async () => {
      setCommentsStatus("loading");
      setCommentsErrorText(null);

      try {
        const response = await fetchSampleComments(sampleId);

        if (cancelled) {
          return;
        }

        setComments(response.comments);
        setCommentsStatus("loaded");
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message =
          error instanceof Error ? error.message : "Failed to load comments. Please retry.";
        setCommentsStatus("error");
        setCommentsErrorText(message);
      }
    };

    void loadComments();

    return () => {
      cancelled = true;
    };
  }, [sampleId, reloadToken]);

  useEffect(() => {
    if (!isMoreOpen) {
      return;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
    };

    document.addEventListener("mousedown", handleDocumentClick);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, [isMoreOpen]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!sample) {
      setCreatorFollowById({});
      setCreatorFollowLoadingById({});
      return;
    }

    const nextFollowById = sample.creators.reduce<Record<string, boolean>>((result, creator) => {
      result[creator.id] = creator.isFollowing;
      return result;
    }, {});

    setCreatorFollowById(nextFollowById);
    setCreatorFollowLoadingById({});
  }, [sample]);

  const handleLike = async () => {
    if (!sample) {
      return;
    }

    const previousLikes = sample.likesCount;
    const previousIsLiked = sample.isLiked;
    const nextIsLiked = !sample.isLiked;
    const nextLikes = nextIsLiked ? previousLikes + 1 : Math.max(0, previousLikes - 1);

    setSample((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        isLiked: nextIsLiked,
        likesCount: nextLikes,
      };
    });

    try {
      await mockToggleLikeRequest(sample.id, nextIsLiked);
    } catch {
      setSample((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          isLiked: previousIsLiked,
          likesCount: previousLikes,
        };
      });

      showNotice("error", "Could not save like. Changes reverted.");
    }
  };

  const handleDownload = () => {
    if (!sample) {
      return;
    }

    downloadSample(sample.audioPreviewUrl, sample.title);
    showNotice("success", "Download started.");
  };

  const handleCopy = async () => {
    if (!sample) {
      return;
    }

    try {
      await copyText(buildSamplePageUrl(sample.id));
      showNotice("success", "Sample link copied.");
    } catch {
      showNotice("error", "Unable to copy link.");
    }
  };

  const handleShare = async () => {
    if (!sample) {
      return;
    }

    const url = buildSamplePageUrl(sample.id);

    try {
      if (navigator.share) {
        await navigator.share({
          title: sample.title,
          url,
        });
        showNotice("success", "Share menu opened.");
      } else {
        await copyText(url);
        showNotice("success", "Share link copied.");
      }
    } catch {
      showNotice("error", "Share action cancelled.");
    } finally {
      setIsMoreOpen(false);
    }
  };

  const handleOpenOriginal = () => {
    if (!sample?.inheritedFrom) {
      showNotice("error", "Original sample is not available.");
      setIsMoreOpen(false);
      return;
    }

    navigate(`/sample/${sample.inheritedFrom.id}`);
    setIsMoreOpen(false);
  };

  const handleCreatorOpen = (creatorId: string) => {
    navigate(`/user/${creatorId}`);
  };

  const isCreatorFollowDisabled = false;

  const handleCreatorFollowToggle = async (creatorId: string) => {
    if (isCreatorFollowDisabled || creatorFollowLoadingById[creatorId]) {
      return;
    }

    const previous =
      creatorFollowById[creatorId] ??
      sample?.creators.find((creator) => creator.id === creatorId)?.isFollowing ??
      false;
    const next = !previous;

    setCreatorFollowById((current) => ({
      ...current,
      [creatorId]: next,
    }));

    setCreatorFollowLoadingById((current) => ({
      ...current,
      [creatorId]: true,
    }));

    try {
      await mockToggleCreatorFollowRequest(creatorId, next);
    } catch {
      setCreatorFollowById((current) => ({
        ...current,
        [creatorId]: previous,
      }));
      showNotice("error", "Could not save follow. Changes reverted.");
    } finally {
      setCreatorFollowLoadingById((current) => {
        const { [creatorId]: _ignored, ...rest } = current;
        return rest;
      });
    }
  };

  const createTemporaryComment = (text: string, parentId?: string): SampleComment => {
    return {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      user: {
        id: LOCAL_COMMENT_USER.id,
        username: LOCAL_COMMENT_USER.username,
        avatarUrl: LOCAL_COMMENT_USER.avatarUrl,
      },
      text,
      createdAt: new Date().toISOString(),
      parentId,
      replies: parentId ? undefined : [],
      isOwner: true,
    };
  };

  const handleAddComment = async (text: string) => {
    if (!sample) {
      return;
    }

    const temporaryComment = createTemporaryComment(text);

    setComments((current) => [temporaryComment, ...current]);

    try {
      const created = await mockCreateCommentRequest(sample.id, text);

      setComments((current) => {
        return current.map((comment) => {
          if (comment.id !== temporaryComment.id) {
            return comment;
          }

          return created;
        });
      });
    } catch (error) {
      setComments((current) => {
        return current.filter((comment) => comment.id !== temporaryComment.id);
      });

      const message = error instanceof Error ? error.message : "Could not post comment.";
      showNotice("error", message);
      throw error;
    }
  };

  const handleReply = async (parentId: string, text: string) => {
    if (!sample) {
      return;
    }

    const temporaryReply = createTemporaryComment(text, parentId);

    setComments((current) => {
      return current.map((comment) => {
        if (comment.id !== parentId) {
          return comment;
        }

        return {
          ...comment,
          replies: [...(comment.replies ?? []), temporaryReply],
        };
      });
    });

    try {
      const createdReply = await mockCreateCommentRequest(sample.id, text, parentId);

      setComments((current) => {
        return current.map((comment) => {
          if (comment.id !== parentId) {
            return comment;
          }

          return {
            ...comment,
            replies: (comment.replies ?? []).map((reply) => {
              if (reply.id !== temporaryReply.id) {
                return reply;
              }

              return createdReply;
            }),
          };
        });
      });
    } catch (error) {
      setComments((current) => {
        return current.map((comment) => {
          if (comment.id !== parentId) {
            return comment;
          }

          return {
            ...comment,
            replies: (comment.replies ?? []).filter((reply) => reply.id !== temporaryReply.id),
          };
        });
      });

      const message = error instanceof Error ? error.message : "Could not post reply.";
      showNotice("error", message);
      throw error;
    }
  };

  const handleRetry = () => {
    setReloadToken((value) => value + 1);
  };

  if (status === "loading") {
    return <SamplePageSkeleton />;
  }

  if (status === "error") {
    return (
      <section className="sample-page sample-page__state" aria-live="polite">
        <h2>Sample loading failed</h2>
        <p>{errorText}</p>
        <button type="button" onClick={handleRetry} className="sample-page__state-action">
          Retry
        </button>
      </section>
    );
  }

  if (status === "empty" || !sample) {
    return (
      <section className="sample-page sample-page__state" aria-live="polite">
        <h2>Sample not found</h2>
        <p>The sample does not exist or was removed.</p>
        <Link to="/" className="sample-page__state-link">
          Back to creator page
        </Link>
      </section>
    );
  }

  return (
    <div className="sample-page">
      <div className="sample-page__inner">
        <aside className="sample-page__left-column">
          <SampleCoverCard imageUrl={sample.coverUrl} title={sample.title} />

          <div className="sample-page__actions-wrap" ref={menuRef}>
            <SampleActionsBar
              likesCount={sample.likesCount}
              isLiked={sample.isLiked}
              onLike={handleLike}
              onAdd={() => undefined}
              onDownload={handleDownload}
              onCopy={() => {
                void handleCopy();
              }}
              onMore={() => setIsMoreOpen((current) => !current)}
              isAddDisabled
            />

            {isMoreOpen ? (
              <div className="sample-page__menu" role="menu" aria-label="More actions">
                <button
                  type="button"
                  className="sample-page__menu-item"
                  onClick={() => {
                    void handleShare();
                  }}
                >
                  Share
                </button>
                <button
                  type="button"
                  className="sample-page__menu-item"
                  onClick={handleOpenOriginal}
                  disabled={!sample.inheritedFrom}
                >
                  Open original sample
                </button>
              </div>
            ) : null}
          </div>

          <div className="sample-page__creators-desktop">
            <CreatorsSection
              creators={creatorsWithFollowState}
              onFollowToggle={(creatorId) => {
                void handleCreatorFollowToggle(creatorId);
              }}
              onCreatorOpen={handleCreatorOpen}
              loadingCreatorIds={loadingCreatorIds}
              isFollowDisabled={isCreatorFollowDisabled}
            />
          </div>
        </aside>

        <section className="sample-page__right-column">
          <SampleHeader
            title={sample.title}
            inheritedFrom={sample.inheritedFrom}
            authors={sample.authors}
          />

          <SampleMeta bpm={sample.bpm} musicalKey={sample.musicalKey} />

          <SampleTags
            tags={sample.tags}
            onTagClick={(tag) => {
              showNotice("success", `Filter ${tag} will be available soon.`);
            }}
          />

          <SamplePlayer
            sampleId={sample.id}
            sampleTitle={sample.title}
            audioUrl={sample.audioPreviewUrl}
            waveformPeaksUrl={sample.waveformPeaksUrl}
            waveformData={sample.waveformData}
            duration={sample.duration}
            isPlayable={Boolean(sample.audioPreviewUrl)}
          />

          <RelatedSamplesSection
            relatedSamples={sample.relatedSamples}
            onAddRemake={() => {
              showNotice("success", "Remake creation flow will be available soon.");
            }}
            onFeedback={showNotice}
          />

          <div className="sample-page__creators-mobile">
            <CreatorsSection
              creators={creatorsWithFollowState}
              onFollowToggle={(creatorId) => {
                void handleCreatorFollowToggle(creatorId);
              }}
              onCreatorOpen={handleCreatorOpen}
              loadingCreatorIds={loadingCreatorIds}
              isFollowDisabled={isCreatorFollowDisabled}
            />
          </div>

          <CommentsSection
            comments={comments}
            totalCount={totalCommentsCount}
            onAddComment={handleAddComment}
            onReply={handleReply}
            isLoading={commentsStatus === "loading"}
            errorText={commentsStatus === "error" ? commentsErrorText : null}
            onRetry={handleRetry}
            onProfileOpen={(userId) => navigate(`/user/${userId}`)}
          />
        </section>
      </div>

      {notice ? (
        <div
          className={`sample-page__notice sample-page__notice--${notice.tone}`}
          role="status"
          aria-live="polite"
        >
          {notice.text}
        </div>
      ) : null}
    </div>
  );
};

export default SamplePage;
