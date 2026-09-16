import type { CreatorRole, SampleStatus } from '../enums';

/**
 * Compact sample shape consumed by the feed, rows and the audio player.
 * Moved verbatim from `apps/frontend/src/types/Sample.ts` minus `price`
 * (the platform is free — see the product decisions in the plan).
 */
export interface Sample {
  id: string | number;
  authorId: string | number;
  author?: string;
  collaboratorIds?: Array<string | number>;
  title: string;
  tags: string[];
  audioUrl: string;
  time: string;
  key: string;
  bpm: string | number;
  type?: string;
  likesCount?: number;
  isLiked?: boolean;
  remakesCount?: number;
  remakes?: Sample[];
  jsonPeaksUrl?: string;
  /** Present on rows served by the real API (Task 3.1a). */
  status?: SampleStatus;
  authorUsername?: string;
  coverUrl?: string;
  downloadsCount?: number;
  playsCount?: number;
  createdAt?: string;
  publishedAt?: string | null;
}

export type SampleAuthor = {
  id: string;
  name: string;
};

export type CreatorStats = {
  followersCount: number;
  remakesMadeCount: number;
  tracksRemixedCount: number;
};

export type CreatorViewModel = {
  id: string;
  username: string;
  avatarUrl?: string;
  roles: CreatorRole[];
  stats: CreatorStats;
  isFollowing: boolean;
};

export type SampleCommentUser = {
  id: string;
  username: string;
  avatarUrl?: string;
};

export type SampleComment = {
  id: string;
  user: SampleCommentUser;
  text: string;
  createdAt: string;
  parentId?: string;
  replies?: SampleComment[];
  isOwner: boolean;
};

export type CommentsSortOption = 'newest' | 'oldest' | 'most-liked';

export type SampleCommentsResponse = {
  totalCount: number;
  comments: SampleComment[];
};

export type InheritedSampleRef = {
  id: string;
  title: string;
};

export type SampleShort = {
  id: string;
  authorId: string;
  author: string;
  title: string;
  tags: string[];
  audioUrl: string;
  time: string;
  key: string;
  bpm: number;
  jsonPeaksUrl?: string;
  likesCount: number;
  isLiked: boolean;
};

export type RelatedSamplesTree = {
  rootOriginal?: SampleShort;
  inheritedOriginal?: SampleShort;
  remakes: SampleShort[];
};

export type SampleDetail = {
  id: string;
  title: string;
  inheritedFrom?: InheritedSampleRef;
  authors: SampleAuthor[];
  creators: CreatorViewModel[];
  coverUrl?: string;
  bpm: number;
  musicalKey: string;
  tags: string[];
  likesCount: number;
  isLiked: boolean;
  audioPreviewUrl: string;
  waveformPeaksUrl?: string;
  waveformData?: number[];
  duration?: number;
  relatedSamples: RelatedSamplesTree;

  // --- fields added by the real API (Task 3.1a); optional so the mock engine
  // and older fixtures keep compiling. The frontend gates edit/delete with
  // `can(actor, 'sample:edit', { kind: 'sample', ownerId, status, collaboratorIds })`.
  ownerId?: string;
  ownerUsername?: string;
  status?: SampleStatus;
  collaboratorIds?: string[];
  description?: string | null;
  sampleType?: string | null;
  processingError?: string | null;
  parentId?: string | null;
  rootId?: string;
  audioMime?: string | null;
  audioSizeBytes?: number | null;
  downloadsCount?: number;
  playsCount?: number;
  remakesCount?: number;
  commentsCount?: number;
  createdAt?: string;
  publishedAt?: string | null;
};
