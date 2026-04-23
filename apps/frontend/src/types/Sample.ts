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
  price: string | number;
  likesCount?: number;
  isLiked?: boolean;
  jsonPeaksUrl?: string;
}