export type SampleAuthor = {
  id: string;
  name: string;
};

export type CreatorRole =
  | "OG_CREATOR"
  | "INHERITED_OG_CREATOR"
  | "CURRENT_CREATOR"
  | "COLLABORATOR";

export const CREATOR_ROLE_PRIORITY: CreatorRole[] = [
  "OG_CREATOR",
  "INHERITED_OG_CREATOR",
  "CURRENT_CREATOR",
  "COLLABORATOR",
];

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

export type CommentsSortOption = "newest" | "oldest" | "most-liked";

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
  price: number;
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
  bpm: number | null;
  musicalKey: string | null;
  tags: string[];
  likesCount: number;
  isLiked: boolean;
  audioPreviewUrl: string;
  waveformPeaksUrl?: string;
  waveformData?: number[];
  duration?: number;
  relatedSamples: RelatedSamplesTree;
};
