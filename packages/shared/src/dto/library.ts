import type { LibraryStatus, LibraryTab } from '../enums';

export type LibraryQuery = {
  tab: LibraryTab;
  search?: string;
  sort?: string;
  status?: LibraryStatus;
  cursor?: string;
  limit?: number;
};

export type LibraryItem = {
  id: string;
  type: 'sample' | 'remake';
  title: string;
  creator: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
  coverUrl: string | null;
  audioPreviewUrl: string | null;
  waveformUrl?: string | null;
  durationSec: number;
  bpm: number | null;
  key: string | null;
  tags: string[];
  stats: {
    plays: number;
    likes: number;
    downloads: number;
    remakes: number;
  };
  userState: {
    liked: boolean;
    downloaded: boolean;
    owned: boolean;
  };
  status?: LibraryStatus;
  originalSample?: {
    id: string;
    title: string;
    creatorUsername: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type LibraryResponse = {
  items: LibraryItem[];
  nextCursor: string | null;
};

export type ContinueWorkingItem = {
  id: string;
  label: string;
  title: string;
  href: string;
};
