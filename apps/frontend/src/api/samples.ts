import { mockSamples } from "../mocks/mockSamples";
import { Sample } from "../types/Sample";
import {
  CREATOR_ROLE_PRIORITY,
  SampleComment,
  SampleCommentsResponse,
  CreatorRole,
  CreatorStats,
  CreatorViewModel,
  InheritedSampleRef,
  RelatedSamplesTree,
  SampleDetail,
  SampleShort,
} from "../types/sampleDetail";

type SampleBucketKey = keyof typeof mockSamples;

export type SamplesSort = "newest" | "popular" | "liked" | "remakes";
export type SamplesAccessType = "free" | "premium";

export type FetchSamplesQuery = {
  search?: string;
  tags?: string[];
  bpm_min?: number;
  bpm_max?: number;
  key?: string;
  type?: SamplesAccessType;
  sort?: SamplesSort;
  cursor?: string;
  limit?: number;
};

export type FetchSamplesResponse = {
  samples: Sample[];
  nextCursor?: string;
};

type MockSampleEntry = {
  bucket: SampleBucketKey;
  sample: Sample;
};

const DEFAULT_LOAD_DELAY_MS = 550;
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const ROOT_SAMPLE_ID = "popular-1";

const SAMPLE_PARENT_MAP: Record<string, string | undefined> = {
  "popular-1": undefined,
  "popular-2": ROOT_SAMPLE_ID,
  "premium-1": ROOT_SAMPLE_ID,
  "liked-1": ROOT_SAMPLE_ID,
  "popular-3": "popular-2",
  "popular-4": "popular-3",
  "popular-5": "premium-1",
  "popular-6": "liked-1",
  "premium-2": "premium-1",
  "liked-2": "popular-2",
};

type MockCreatorProfile = {
  id: string;
  username: string;
  avatarUrl?: string;
  stats: CreatorStats;
  isFollowing: boolean;
};

const DEFAULT_CREATOR_STATS: CreatorStats = {
  followersCount: 0,
  remakesMadeCount: 0,
  tracksRemixedCount: 0,
};

const ROLE_PRIORITY_INDEX = CREATOR_ROLE_PRIORITY.reduce<Record<CreatorRole, number>>(
  (result, role, index) => {
    result[role] = index;
    return result;
  },
  {
    OG_CREATOR: 0,
    INHERITED_OG_CREATOR: 1,
    CURRENT_CREATOR: 2,
    COLLABORATOR: 3,
  }
);

const MOCK_CREATOR_PROFILES: Record<string, MockCreatorProfile> = {
  u1: {
    id: "u1",
    username: "southkid",
    avatarUrl: "/img/avatar.jpg",
    stats: {
      followersCount: 284000,
      remakesMadeCount: 24,
      tracksRemixedCount: 18,
    },
    isFollowing: false,
  },
  u2: {
    id: "u2",
    username: "squaredealer",
    avatarUrl: "/img/avatar.jpg",
    stats: {
      followersCount: 74000,
      remakesMadeCount: 17,
      tracksRemixedCount: 23,
    },
    isFollowing: true,
  },
  u3: {
    id: "u3",
    username: "bagamemphis",
    avatarUrl: "/img/avatar.jpg",
    stats: {
      followersCount: 96200,
      remakesMadeCount: 31,
      tracksRemixedCount: 11,
    },
    isFollowing: false,
  },
  u4: {
    id: "u4",
    username: "vhsghost",
    avatarUrl: "/img/avatar.jpg",
    stats: {
      followersCount: 38200,
      remakesMadeCount: 12,
      tracksRemixedCount: 14,
    },
    isFollowing: false,
  },
  u5: {
    id: "u5",
    username: "astralchild",
    avatarUrl: "/img/avatar.jpg",
    stats: {
      followersCount: 128000,
      remakesMadeCount: 41,
      tracksRemixedCount: 36,
    },
    isFollowing: true,
  },
  u6: {
    id: "u6",
    username: "caldera",
    avatarUrl: "/img/avatar.jpg",
    stats: {
      followersCount: 19400,
      remakesMadeCount: 9,
      tracksRemixedCount: 7,
    },
    isFollowing: false,
  },
  u7: {
    id: "u7",
    username: "andrezj",
    avatarUrl: "/img/avatar.jpg",
    stats: {
      followersCount: 56200,
      remakesMadeCount: 21,
      tracksRemixedCount: 19,
    },
    isFollowing: false,
  },
  u8: {
    id: "u8",
    username: "loopmage",
    stats: {
      followersCount: 8300,
      remakesMadeCount: 6,
      tracksRemixedCount: 4,
    },
    isFollowing: false,
  },
};

const MOCK_COMMENT_AUTHOR_ID = "u2";
const DEFAULT_COMMENTS_DELAY_MS = 360;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const toPastIso = (offsetMs: number): string => {
  return new Date(Date.now() - offsetMs).toISOString();
};

const toCommentUser = (userId: string) => {
  const profile = MOCK_CREATOR_PROFILES[userId];

  if (!profile) {
    return {
      id: userId,
      username: "unknown",
      avatarUrl: undefined,
    };
  }

  return {
    id: profile.id,
    username: profile.username,
    avatarUrl: profile.avatarUrl,
  };
};

const MOCK_COMMENTS_BY_SAMPLE: Record<string, SampleComment[]> = {
  "popular-1": [
    {
      id: "c-1",
      user: toCommentUser("u1"),
      text: "This root sample still sounds huge on headphones.",
      createdAt: toPastIso(4 * DAY_MS),
      isOwner: false,
      replies: [
        {
          id: "c-1-r-1",
          parentId: "c-1",
          user: toCommentUser("u2"),
          text: "Facts. I use this one as reference all the time.",
          createdAt: toPastIso(3 * DAY_MS + 6 * HOUR_MS),
          isOwner: true,
        },
      ],
    },
    {
      id: "c-2",
      user: toCommentUser("u5"),
      text: "Can you drop a longer variation of this loop?",
      createdAt: toPastIso(10 * HOUR_MS),
      isOwner: false,
      replies: [],
    },
    {
      id: "c-3",
      user: toCommentUser("u3"),
      text: "Clean transients. Works great for halftime flips.",
      createdAt: toPastIso(95 * MINUTE_MS),
      isOwner: false,
      replies: [
        {
          id: "c-3-r-1",
          parentId: "c-3",
          user: toCommentUser("u6"),
          text: "+1, especially after slight tape saturation.",
          createdAt: toPastIso(70 * MINUTE_MS),
          isOwner: false,
        },
      ],
    },
  ],
  "popular-2": [
    {
      id: "c-4",
      user: toCommentUser("u7"),
      text: "Snare tone is perfect. Nothing to tweak.",
      createdAt: toPastIso(2 * DAY_MS + 2 * HOUR_MS),
      isOwner: false,
      replies: [],
    },
  ],
  "premium-1": [
    {
      id: "c-5",
      user: toCommentUser("u4"),
      text: "The texture in the background is super cinematic.",
      createdAt: toPastIso(6 * HOUR_MS),
      isOwner: false,
      replies: [],
    },
  ],
};

const commentsStore = new Map<string, SampleComment[]>();

const cloneComment = (comment: SampleComment): SampleComment => {
  return {
    ...comment,
    user: {
      ...comment.user,
    },
    replies: comment.replies ? comment.replies.map(cloneComment) : undefined,
  };
};

const cloneComments = (comments: SampleComment[]): SampleComment[] => {
  return comments.map(cloneComment);
};

const countCommentsTree = (comments: SampleComment[]): number => {
  return comments.reduce((sum, comment) => {
    const repliesCount = comment.replies?.length ?? 0;
    return sum + 1 + repliesCount;
  }, 0);
};

const ensureCommentsInStore = (sampleId: string): SampleComment[] => {
  const existing = commentsStore.get(sampleId);
  if (existing) {
    return existing;
  }

  const seeded = cloneComments(MOCK_COMMENTS_BY_SAMPLE[sampleId] ?? []);
  commentsStore.set(sampleId, seeded);
  return seeded;
};

const wait = (delayMs: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

const parseDuration = (timeLabel: string): number | undefined => {
  const chunks = timeLabel.split(":");
  if (chunks.length !== 2) return undefined;

  const minutes = Number(chunks[0]);
  const seconds = Number(chunks[1]);

  if (Number.isNaN(minutes) || Number.isNaN(seconds)) {
    return undefined;
  }

  return minutes * 60 + seconds;
};

const calculateLikesCount = (sampleId: string): number => {
  const hash = Array.from(sampleId).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return 1000 + (hash % 14000);
};

const collectAllMockSamples = (): MockSampleEntry[] => {
  const buckets = Object.keys(mockSamples) as SampleBucketKey[];

  return buckets.flatMap((bucket) => {
    return mockSamples[bucket].map((sample) => ({ bucket, sample }));
  });
};

const appendDefinedParam = (params: URLSearchParams, key: string, value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return;
  }

  params.set(key, String(value));
};

const buildSamplesSearchParams = (query: FetchSamplesQuery): URLSearchParams => {
  const params = new URLSearchParams();

  appendDefinedParam(params, "search", query.search?.trim());
  appendDefinedParam(params, "bpm_min", query.bpm_min);
  appendDefinedParam(params, "bpm_max", query.bpm_max);
  appendDefinedParam(params, "key", query.key);
  appendDefinedParam(params, "type", query.type);
  appendDefinedParam(params, "sort", query.sort ?? "newest");
  appendDefinedParam(params, "cursor", query.cursor);
  appendDefinedParam(params, "limit", query.limit ?? 20);

  if (query.tags?.length) {
    params.set("tags", query.tags.join(","));
  }

  return params;
};

const normalizeSamplesResponse = (payload: unknown): FetchSamplesResponse => {
  const response = payload as Partial<FetchSamplesResponse> & {
    items?: Sample[];
    data?: Sample[];
  };

  return {
    samples: response.samples ?? response.items ?? response.data ?? [],
    nextCursor: response.nextCursor,
  };
};

const toComparableBpm = (sample: Sample): number | undefined => {
  const bpm = Number(sample.bpm);
  return Number.isFinite(bpm) ? bpm : undefined;
};

const getMockAccessType = (entry: MockSampleEntry): SamplesAccessType => {
  return entry.bucket === "premium" || Number(entry.sample.price) > 0 ? "premium" : "free";
};

const fetchMockSamples = async (query: FetchSamplesQuery): Promise<FetchSamplesResponse> => {
  await wait(DEFAULT_LOAD_DELAY_MS);

  const search = query.search?.trim().toLowerCase();
  const tags = query.tags ?? [];
  const cursor = query.cursor ? Number(query.cursor) : 0;
  const offset = Number.isFinite(cursor) && cursor > 0 ? cursor : 0;
  const limit = query.limit ?? 20;

  const filteredEntries = collectAllMockSamples()
    .filter(({ bucket, sample }) => {
      if (query.sort === "liked" && bucket !== "liked") {
        return false;
      }

      if (search) {
        const haystack = [sample.title, sample.author, ...sample.tags].join(" ").toLowerCase();
        if (!haystack.includes(search)) {
          return false;
        }
      }

      if (tags.length && !tags.every((tag) => sample.tags.includes(tag))) {
        return false;
      }

      const bpm = toComparableBpm(sample);
      if (query.bpm_min !== undefined && (bpm === undefined || bpm < query.bpm_min)) {
        return false;
      }

      if (query.bpm_max !== undefined && (bpm === undefined || bpm > query.bpm_max)) {
        return false;
      }

      if (query.key && sample.key !== query.key) {
        return false;
      }

      if (query.type && getMockAccessType({ bucket, sample }) !== query.type) {
        return false;
      }

      return true;
    })
    .sort((entryA, entryB) => {
      if (query.sort === "popular") {
        return calculateLikesCount(String(entryB.sample.id)) - calculateLikesCount(String(entryA.sample.id));
      }

      if (query.sort === "remakes") {
        return calculateRemakesCount(String(entryB.sample.id)) - calculateRemakesCount(String(entryA.sample.id));
      }

      return String(entryB.sample.id).localeCompare(String(entryA.sample.id));
    });

  const pageEntries = filteredEntries.slice(offset, offset + limit);
  const nextOffset = offset + pageEntries.length;

  return {
    samples: pageEntries.map(({ bucket, sample }) => toFeedSample(sample, bucket)),
    nextCursor: nextOffset < filteredEntries.length ? String(nextOffset) : undefined,
  };
};

const getParentId = (sampleId: string): string | undefined => {
  if (sampleId === ROOT_SAMPLE_ID) {
    return undefined;
  }

  return SAMPLE_PARENT_MAP[sampleId] ?? ROOT_SAMPLE_ID;
};

const calculateRemakesCount = (sampleId: string): number => {
  return collectAllMockSamples().filter(({ sample }) => getParentId(String(sample.id)) === sampleId).length;
};

const toFeedSample = (sample: Sample, bucket: SampleBucketKey): Sample => {
  const sampleId = String(sample.id);
  const remakes = collectAllMockSamples()
    .filter(({ sample: childSample }) => getParentId(String(childSample.id)) === sampleId)
    .map(({ bucket: remakeBucket, sample: remakeSample }) => ({
      ...remakeSample,
      likesCount: calculateLikesCount(String(remakeSample.id)),
      isLiked: remakeBucket === "liked",
      remakesCount: calculateRemakesCount(String(remakeSample.id)),
    }));

  return {
    ...sample,
    likesCount: calculateLikesCount(sampleId),
    isLiked: bucket === "liked",
    remakesCount: remakes.length,
    remakes,
  };
};

const sanitizeUsername = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "unknown";
  }

  return trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
};

const resolveCreatorProfile = (
  userId: string | number | undefined,
  fallbackName?: string
): MockCreatorProfile => {
  const normalizedId = String(userId ?? "").trim();
  if (normalizedId && MOCK_CREATOR_PROFILES[normalizedId]) {
    return MOCK_CREATOR_PROFILES[normalizedId];
  }

  const usernameSource = fallbackName ?? normalizedId;
  const username = sanitizeUsername(usernameSource || "unknown");
  const fallbackId = normalizedId || `user-${username}`;

  return {
    id: fallbackId,
    username,
    stats: DEFAULT_CREATOR_STATS,
    isFollowing: false,
  };
};

const sortCreatorRoles = (roles: CreatorRole[]): CreatorRole[] => {
  return [...roles].sort((roleA, roleB) => {
    return ROLE_PRIORITY_INDEX[roleA] - ROLE_PRIORITY_INDEX[roleB];
  });
};

const upsertCreator = (
  creatorsMap: Map<string, CreatorViewModel>,
  profile: MockCreatorProfile,
  role: CreatorRole
) => {
  const existing = creatorsMap.get(profile.id);

  if (!existing) {
    creatorsMap.set(profile.id, {
      id: profile.id,
      username: profile.username,
      avatarUrl: profile.avatarUrl,
      roles: [role],
      stats: {
        followersCount: profile.stats.followersCount,
        remakesMadeCount: profile.stats.remakesMadeCount,
        tracksRemixedCount: profile.stats.tracksRemixedCount,
      },
      isFollowing: profile.isFollowing,
    });
    return;
  }

  if (!existing.roles.includes(role)) {
    existing.roles = sortCreatorRoles([...existing.roles, role]);
  }
};

const buildCreators = (currentSample: Sample, entries: MockSampleEntry[]): CreatorViewModel[] => {
  const creatorsMap = new Map<string, CreatorViewModel>();
  const currentSampleId = String(currentSample.id);
  const rootEntry = findEntryById(entries, ROOT_SAMPLE_ID);
  const parentId = getParentId(currentSampleId);

  if (rootEntry) {
    const rootAuthor = resolveCreatorProfile(rootEntry.sample.authorId, rootEntry.sample.author);
    upsertCreator(creatorsMap, rootAuthor, "OG_CREATOR");
  }

  if (parentId && parentId !== ROOT_SAMPLE_ID) {
    const inheritedEntry = findEntryById(entries, parentId);
    if (inheritedEntry) {
      const inheritedAuthor = resolveCreatorProfile(
        inheritedEntry.sample.authorId,
        inheritedEntry.sample.author
      );
      upsertCreator(creatorsMap, inheritedAuthor, "INHERITED_OG_CREATOR");
    }
  }

  const currentAuthor = resolveCreatorProfile(currentSample.authorId, currentSample.author);
  upsertCreator(creatorsMap, currentAuthor, "CURRENT_CREATOR");

  (currentSample.collaboratorIds ?? []).forEach((collaboratorId) => {
    const collaborator = resolveCreatorProfile(collaboratorId);
    upsertCreator(creatorsMap, collaborator, "COLLABORATOR");
  });

  return Array.from(creatorsMap.values()).sort((creatorA, creatorB) => {
    const rankA = Math.min(...creatorA.roles.map((role) => ROLE_PRIORITY_INDEX[role]));
    const rankB = Math.min(...creatorB.roles.map((role) => ROLE_PRIORITY_INDEX[role]));

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    return creatorA.username.localeCompare(creatorB.username);
  });
};

const findEntryById = (
  entries: MockSampleEntry[],
  sampleId: string
): MockSampleEntry | undefined => {
  return entries.find(({ sample }) => String(sample.id) === sampleId);
};

const toSampleShort = (sample: Sample, bucket: SampleBucketKey): SampleShort => {
  const authorProfile = resolveCreatorProfile(sample.authorId, sample.author);

  return {
    id: String(sample.id),
    authorId: authorProfile.id,
    author: `@${authorProfile.username}`,
    title: sample.title,
    tags: sample.tags,
    audioUrl: sample.audioUrl,
    time: sample.time,
    key: sample.key,
    bpm: Number(sample.bpm),
    price: Number(sample.price),
    jsonPeaksUrl: sample.jsonPeaksUrl,
    likesCount: calculateLikesCount(String(sample.id)),
    isLiked: bucket === "liked",
  };
};

const createInheritedRef = (
  sampleId: string,
  entries: MockSampleEntry[]
): InheritedSampleRef | undefined => {
  const parentId = getParentId(sampleId);
  if (!parentId) {
    return undefined;
  }

  const parent = findEntryById(entries, parentId);
  if (!parent) {
    return undefined;
  }

  return {
    id: parentId,
    title: parent.sample.title,
  };
};

const buildRelatedSamples = (
  currentSampleId: string,
  entries: MockSampleEntry[]
): RelatedSamplesTree => {
  const rootEntry = findEntryById(entries, ROOT_SAMPLE_ID);
  const parentId = getParentId(currentSampleId);

  const rootOriginal =
    currentSampleId !== ROOT_SAMPLE_ID && rootEntry
      ? toSampleShort(rootEntry.sample, rootEntry.bucket)
      : undefined;

  const inheritedOriginal =
    parentId && parentId !== ROOT_SAMPLE_ID
      ? (() => {
          const inheritedEntry = findEntryById(entries, parentId);
          if (!inheritedEntry) {
            return undefined;
          }

          return toSampleShort(inheritedEntry.sample, inheritedEntry.bucket);
        })()
      : undefined;

  const remakes = entries
    .filter(({ sample }) => {
      return getParentId(String(sample.id)) === currentSampleId;
    })
    .map(({ sample, bucket }) => toSampleShort(sample, bucket));

  return {
    rootOriginal,
    inheritedOriginal,
    remakes,
  };
};

const toSampleDetail = (
  sample: Sample,
  bucket: SampleBucketKey,
  entries: MockSampleEntry[]
): SampleDetail => {
  const sampleId = String(sample.id);
  const sampleAuthor = resolveCreatorProfile(sample.authorId, sample.author);

  return {
    id: sampleId,
    title: sample.title,
    inheritedFrom: createInheritedRef(sampleId, entries),
    authors: [
      {
        id: sampleAuthor.id,
        name: `@${sampleAuthor.username}`,
      },
    ],
    creators: buildCreators(sample, entries),
    coverUrl: sample.id.toString().endsWith("1") ? "/img/avatar.jpg" : undefined,
    bpm: Number(sample.bpm),
    musicalKey: sample.key,
    tags: sample.tags,
    likesCount: calculateLikesCount(String(sample.id)),
    isLiked: bucket === "liked",
    audioPreviewUrl: sample.audioUrl,
    waveformPeaksUrl: sample.jsonPeaksUrl,
    duration: parseDuration(sample.time),
    relatedSamples: buildRelatedSamples(sampleId, entries),
  };
};

export const listMockSampleIds = (): string[] => {
  return collectAllMockSamples().map(({ sample }) => String(sample.id));
};

export const fetchSamples = async (query: FetchSamplesQuery): Promise<FetchSamplesResponse> => {
  const params = buildSamplesSearchParams(query);
  try {
    const response = await fetch(`${API_URL}/samples?${params.toString()}`, {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      return fetchMockSamples(query);
    }

    return normalizeSamplesResponse(await response.json());
  } catch {
    return fetchMockSamples(query);
  }
};

export const fetchSampleById = async (
  sampleId: string,
  options?: { delayMs?: number }
): Promise<SampleDetail | null> => {
  if (sampleId === "error") {
    await wait(options?.delayMs ?? DEFAULT_LOAD_DELAY_MS);
    throw new Error("Failed to load sample. Please retry.");
  }

  if (!sampleId || sampleId === "empty") {
    await wait(options?.delayMs ?? DEFAULT_LOAD_DELAY_MS);
    return null;
  }

  // Prefer the real backend; fall back to mock data when it is unavailable.
  try {
    const response = await fetch(`${API_URL}/samples/${encodeURIComponent(sampleId)}`, {
      method: "GET",
      credentials: "include",
    });
    if (response.ok) {
      return (await response.json()) as SampleDetail;
    }
    if (response.status === 404) {
      return null;
    }
  } catch {
    // network error — fall through to mock data
  }

  const delayMs = options?.delayMs ?? DEFAULT_LOAD_DELAY_MS;
  await wait(delayMs);

  const allEntries = collectAllMockSamples();
  const found = allEntries.find(({ sample }) => String(sample.id) === sampleId);

  if (!found) {
    return null;
  }

  return toSampleDetail(found.sample, found.bucket, allEntries);
};

export const toggleSampleLike = async (
  sampleId: string,
  nextLiked: boolean
): Promise<void> => {
  try {
    const response = await fetch(`${API_URL}/samples/${sampleId}/like`, {
      method: nextLiked ? "PUT" : "DELETE",
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("Like request failed.");
    }
  } catch (error) {
    // A real HTTP rejection should surface (and roll back the optimistic UI);
    // a network failure (backend unreachable) degrades gracefully.
    if (error instanceof Error && error.message === "Like request failed.") {
      throw error;
    }
  }
};

export const toggleCreatorFollow = async (
  creatorId: string,
  nextFollowing: boolean
): Promise<void> => {
  try {
    const response = await fetch(`${API_URL}/creators/${creatorId}/follow`, {
      method: nextFollowing ? "PUT" : "DELETE",
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("Creator follow request failed.");
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Creator follow request failed."
    ) {
      throw error;
    }
  }
};

const createCommentId = (): string => {
  const random = Math.random().toString(36).slice(2, 8);
  return `c-${Date.now()}-${random}`;
};

export const fetchSampleComments = async (
  sampleId: string,
  options?: { delayMs?: number }
): Promise<SampleCommentsResponse> => {
  if (!sampleId) {
    return { totalCount: 0, comments: [] };
  }

  try {
    const response = await fetch(
      `${API_URL}/samples/${encodeURIComponent(sampleId)}/comments`,
      { method: "GET", credentials: "include" }
    );
    if (response.ok) {
      const data = (await response.json()) as SampleCommentsResponse;
      return {
        totalCount: data.totalCount ?? data.comments?.length ?? 0,
        comments: data.comments ?? [],
      };
    }
  } catch {
    // fall through to mock data when the backend is unavailable
  }

  const delayMs = options?.delayMs ?? DEFAULT_COMMENTS_DELAY_MS;
  await wait(delayMs);

  if (sampleId.includes("error-comments")) {
    throw new Error("Failed to load comments. Please retry.");
  }

  const comments = cloneComments(ensureCommentsInStore(sampleId));
  return {
    totalCount: countCommentsTree(comments),
    comments,
  };
};

export const createComment = async (
  sampleId: string,
  text: string,
  parentId?: string
): Promise<SampleComment> => {
  const normalizedText = text.trim();
  if (!normalizedText) {
    throw new Error("Comment text is required.");
  }

  try {
    const response = await fetch(
      `${API_URL}/samples/${encodeURIComponent(sampleId)}/comments`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: normalizedText, parentId }),
      }
    );
    if (response.ok) {
      return (await response.json()) as SampleComment;
    }
    if (!response.ok) {
      throw new Error("Comment request failed.");
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Comment request failed.") {
      throw error;
    }
    // Network failure — fall back to the in-memory mock store.
  }

  const comments = ensureCommentsInStore(sampleId);
  const createdComment: SampleComment = {
    id: createCommentId(),
    user: toCommentUser(MOCK_COMMENT_AUTHOR_ID),
    text: normalizedText,
    createdAt: new Date().toISOString(),
    parentId,
    replies: parentId ? undefined : [],
    isOwner: true,
  };

  if (parentId) {
    const parent = comments.find((comment) => comment.id === parentId);
    if (!parent) {
      throw new Error("Parent comment not found.");
    }
    parent.replies = [...(parent.replies ?? []), createdComment];
    return cloneComment(createdComment);
  }

  comments.unshift(createdComment);
  return cloneComment(createdComment);
};
