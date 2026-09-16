import type {
  ContinueWorkingItem,
  LibraryItem,
  LibraryQuery,
  LibraryResponse,
  LibraryTab,
} from "@retrosampled/shared";

/**
 * In-memory library used when `VITE_USE_MOCKS=true`. Moved verbatim from the
 * old `api/library.ts`; the real client now lives there.
 */

const date = (daysAgo: number) => {
  const value = new Date();
  value.setDate(value.getDate() - daysAgo);
  return value.toISOString();
};

const audio = (name: string) => `/audio/${name}`;
const waveform = (name: string) => `/waveforms/${name}`;

const baseItems: LibraryItem[] = [
  {
    id: "liked-1",
    type: "sample",
    title: "Lo-Fi Dreams",
    creator: { id: "1", username: "bagamemphis", avatarUrl: null },
    coverUrl: null,
    audioPreviewUrl: audio("ALL EYES ON ME CHOP.wav"),
    waveformUrl: waveform("ALL EYES ON ME CHOP.json"),
    durationSec: 32,
    bpm: 85,
    key: "Am",
    tags: ["lofi", "chill", "ambient"],
    stats: { plays: 1830, likes: 241, downloads: 79, remakes: 12 },
    userState: { liked: true, downloaded: true, owned: false },
    createdAt: date(18),
    updatedAt: date(1),
  },
  {
    id: "liked-2",
    type: "sample",
    title: "Retro Vibes",
    creator: { id: "2", username: "analogriot", avatarUrl: null },
    coverUrl: null,
    audioPreviewUrl: audio("BULLET CHOP.wav"),
    waveformUrl: waveform("BULLET CHOP.json"),
    durationSec: 45,
    bpm: 120,
    key: "Dm",
    tags: ["retro", "synth", "80s"],
    stats: { plays: 6210, likes: 842, downloads: 180, remakes: 44 },
    userState: { liked: true, downloaded: false, owned: false },
    createdAt: date(42),
    updatedAt: date(2),
  },
  {
    id: "downloaded-1",
    type: "sample",
    title: "VHS Drums Pack",
    creator: { id: "3", username: "tapeghost", avatarUrl: null },
    coverUrl: null,
    audioPreviewUrl: audio("CHECKMATES LOOP.wav"),
    waveformUrl: waveform("CHECKMATES LOOP.json"),
    durationSec: 28,
    bpm: 94,
    key: "C#m",
    tags: ["drums", "vhs", "dusty"],
    stats: { plays: 930, likes: 120, downloads: 320, remakes: 8 },
    userState: { liked: false, downloaded: true, owned: false },
    createdAt: date(7),
    updatedAt: date(0),
  },
  {
    id: "upload-1",
    type: "sample",
    title: "Midnight Arcade Loop",
    creator: { id: "current", username: "you", avatarUrl: null },
    coverUrl: null,
    audioPreviewUrl: audio("ASTRAL CHOP.wav"),
    waveformUrl: waveform("ASTRAL CHOP.json"),
    durationSec: 41,
    bpm: 102,
    key: "Fm",
    tags: ["arcade", "loop", "melody"],
    stats: { plays: 211, likes: 33, downloads: 14, remakes: 3 },
    userState: { liked: false, downloaded: false, owned: true },
    status: "published",
    createdAt: date(5),
    updatedAt: date(1),
  },
  {
    id: "upload-2",
    type: "sample",
    title: "Draft Upload: VHS Drums Pack",
    creator: { id: "current", username: "you", avatarUrl: null },
    coverUrl: null,
    audioPreviewUrl: audio("CHECK OUT TIME LOOP.wav"),
    waveformUrl: waveform("CHECK OUT TIME LOOP.json"),
    durationSec: 22,
    bpm: 88,
    key: "Em",
    tags: ["drums", "draft", "tape"],
    stats: { plays: 0, likes: 0, downloads: 0, remakes: 0 },
    userState: { liked: false, downloaded: false, owned: true },
    status: "draft",
    createdAt: date(2),
    updatedAt: date(0),
  },
  {
    id: "remake-1",
    type: "remake",
    title: "Retro Vibes Night Edit",
    creator: { id: "current", username: "you", avatarUrl: null },
    coverUrl: null,
    audioPreviewUrl: audio("BOARDS OF CANADA CHOP.wav"),
    waveformUrl: waveform("BOARDS OF CANADA CHOP.json"),
    durationSec: 44,
    bpm: 120,
    key: "Dm",
    tags: ["remake", "synth", "night"],
    stats: { plays: 144, likes: 22, downloads: 0, remakes: 0 },
    userState: { liked: false, downloaded: false, owned: true },
    status: "draft",
    originalSample: { id: "liked-2", title: "Retro Vibes", creatorUsername: "analogriot" },
    createdAt: date(6),
    updatedAt: date(0),
  },
];

const tabItems: Record<LibraryTab, LibraryItem[]> = {
  liked: baseItems.filter((item) => item.userState.liked && !item.userState.owned),
  downloaded: baseItems.filter((item) => item.userState.downloaded && !item.userState.owned),
  uploads: baseItems.filter((item) => item.userState.owned && item.type === "sample"),
  remakes: baseItems.filter((item) => item.userState.owned && item.type === "remake"),
};

const getSearchText = (item: LibraryItem) =>
  [
    item.title,
    item.creator.username,
    item.tags.join(" "),
    item.bpm?.toString() ?? "",
    item.key ?? "",
    item.originalSample?.title ?? "",
    item.originalSample?.creatorUsername ?? "",
  ]
    .join(" ")
    .toLowerCase();

const sortItems = (items: LibraryItem[], sort?: string) => {
  const sorted = [...items];
  switch (sort) {
    case "most-popular":
    case "original-popularity":
    case "most-liked":
      return sorted.sort((a, b) => b.stats.likes - a.stats.likes);
    case "most-played":
      return sorted.sort((a, b) => b.stats.plays - a.stats.plays);
    default:
      return sorted.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }
};

export const mockContinueWorkingItems = async (): Promise<ContinueWorkingItem[]> => {
  await new Promise((resolve) => setTimeout(resolve, 120));
  return [
    { id: "cw-remake", label: "Draft remake", title: "Retro Vibes Night Edit", href: "/sample/remake-1/edit" },
    { id: "cw-sample", label: "Last opened", title: "Lo-Fi Dreams", href: "/sample/liked-1" },
  ];
};

export const mockLibraryItems = async (query: LibraryQuery): Promise<LibraryResponse> => {
  await new Promise((resolve) => setTimeout(resolve, 200));

  const search = query.search?.trim().toLowerCase();
  const cursor = query.cursor ? Number(query.cursor) : 0;
  const limit = query.limit ?? 20;

  let items = tabItems[query.tab] ?? [];
  if (query.status) items = items.filter((item) => item.status === query.status);
  if (search) items = items.filter((item) => getSearchText(item).includes(search));
  items = sortItems(items, query.sort);

  const page = items.slice(cursor, cursor + limit);
  const next = cursor + limit < items.length ? String(cursor + limit) : null;

  return { items: page, nextCursor: next };
};
