// Response shapes mirrored from the frontend contracts
// (apps/frontend/src/types/Sample.ts and sampleDetail.ts).

export type FeedSample = {
  id: string;
  authorId: string;
  author: string;
  collaboratorIds: string[];
  title: string;
  tags: string[];
  audioUrl: string;
  time: string;
  key: string | null;
  bpm: number | null;
  type?: string;
  price: number;
  likesCount: number;
  isLiked: boolean;
  remakesCount: number;
  remakes: FeedSample[];
  jsonPeaksUrl?: string | null;
};

export type FeedResponse = {
  samples: FeedSample[];
  nextCursor?: string;
};

export type CreatorRole =
  | 'OG_CREATOR'
  | 'INHERITED_OG_CREATOR'
  | 'CURRENT_CREATOR'
  | 'COLLABORATOR';

export type CreatorStats = {
  followersCount: number;
  remakesMadeCount: number;
  tracksRemixedCount: number;
};

export type CreatorViewModel = {
  id: string;
  username: string;
  avatarUrl?: string | null;
  roles: CreatorRole[];
  stats: CreatorStats;
  isFollowing: boolean;
};

export type SampleShort = {
  id: string;
  authorId: string;
  author: string;
  title: string;
  tags: string[];
  audioUrl: string;
  time: string;
  key: string | null;
  bpm: number | null;
  price: number;
  jsonPeaksUrl?: string | null;
  likesCount: number;
  isLiked: boolean;
};

export type SampleDetail = {
  id: string;
  title: string;
  inheritedFrom?: { id: string; title: string };
  authors: { id: string; name: string }[];
  creators: CreatorViewModel[];
  coverUrl?: string | null;
  bpm: number | null;
  musicalKey: string | null;
  tags: string[];
  likesCount: number;
  isLiked: boolean;
  audioPreviewUrl: string;
  waveformPeaksUrl?: string | null;
  duration?: number;
  relatedSamples: {
    rootOriginal?: SampleShort;
    inheritedOriginal?: SampleShort;
    remakes: SampleShort[];
  };
};

export const ROLE_PRIORITY: CreatorRole[] = [
  'OG_CREATOR',
  'INHERITED_OG_CREATOR',
  'CURRENT_CREATOR',
  'COLLABORATOR',
];

export function formatDuration(durationSec: number): string {
  const total = Math.max(0, Math.floor(durationSec));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
