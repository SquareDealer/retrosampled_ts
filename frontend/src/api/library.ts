import {
  ContinueWorkingItem,
  LibraryItem,
  LibraryQuery,
  LibraryResponse,
  LibraryTab,
} from "../types/Library";

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
    creator: { id: "1", username: "@bagamemphis", avatarUrl: null },
    coverUrl: null,
    audioPreviewUrl: audio("ALL EYES ON ME CHOP.wav"),
    waveformUrl: waveform("ALL EYES ON ME CHOP.json"),
    durationSec: 32,
    bpm: 85,
    key: "Am",
    tags: ["lofi", "chill", "ambient"],
    accessType: "free",
    stats: { plays: 1830, likes: 241, downloads: 79, remakes: 12 },
    userState: { liked: true, downloaded: true, owned: false },
    createdAt: date(18),
    updatedAt: date(1),
  },
  {
    id: "liked-2",
    type: "sample",
    title: "Retro Vibes",
    creator: { id: "2", username: "@analogriot", avatarUrl: null },
    coverUrl: null,
    audioPreviewUrl: audio("BULLET CHOP.wav"),
    waveformUrl: waveform("BULLET CHOP.json"),
    durationSec: 45,
    bpm: 120,
    key: "Dm",
    tags: ["retro", "synth", "80s"],
    accessType: "premium",
    stats: { plays: 6210, likes: 842, downloads: 180, remakes: 44 },
    userState: { liked: true, downloaded: false, owned: false },
    createdAt: date(42),
    updatedAt: date(2),
  },
  {
    id: "downloaded-1",
    type: "sample",
    title: "VHS Drums Pack",
    creator: { id: "3", username: "@tapeghost", avatarUrl: null },
    coverUrl: null,
    audioPreviewUrl: audio("CHECKMATES LOOP.wav"),
    waveformUrl: waveform("CHECKMATES LOOP.json"),
    durationSec: 28,
    bpm: 94,
    key: "C#m",
    tags: ["drums", "vhs", "dusty"],
    accessType: "free",
    stats: { plays: 930, likes: 120, downloads: 320, remakes: 8 },
    userState: { liked: false, downloaded: true, owned: false },
    createdAt: date(7),
    updatedAt: date(0),
  },
  {
    id: "downloaded-2",
    type: "sample",
    title: "Caldera Chop",
    creator: { id: "4", username: "@cratediver", avatarUrl: null },
    coverUrl: null,
    audioPreviewUrl: audio("CALDERA CHOP.wav"),
    waveformUrl: waveform("CALDERA CHOP.json"),
    durationSec: 38,
    bpm: 76,
    key: "Gm",
    tags: ["soul", "chop", "warm"],
    accessType: "premium",
    stats: { plays: 4010, likes: 515, downloads: 202, remakes: 31 },
    userState: { liked: true, downloaded: true, owned: false },
    createdAt: date(60),
    updatedAt: date(5),
  },
  {
    id: "upload-1",
    type: "sample",
    title: "Midnight Arcade Loop",
    creator: { id: "current", username: "@you", avatarUrl: null },
    coverUrl: null,
    audioPreviewUrl: audio("ASTRAL CHOP.wav"),
    waveformUrl: waveform("ASTRAL CHOP.json"),
    durationSec: 41,
    bpm: 102,
    key: "Fm",
    tags: ["arcade", "loop", "melody"],
    accessType: "free",
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
    creator: { id: "current", username: "@you", avatarUrl: null },
    coverUrl: null,
    audioPreviewUrl: audio("CHECK OUT TIME LOOP.wav"),
    waveformUrl: waveform("CHECK OUT TIME LOOP.json"),
    durationSec: 22,
    bpm: 88,
    key: "Em",
    tags: ["drums", "draft", "tape"],
    accessType: "free",
    stats: { plays: 0, likes: 0, downloads: 0, remakes: 0 },
    userState: { liked: false, downloaded: false, owned: true },
    status: "draft",
    createdAt: date(2),
    updatedAt: date(0),
  },
  {
    id: "upload-3",
    type: "sample",
    title: "Private Choir Texture",
    creator: { id: "current", username: "@you", avatarUrl: null },
    coverUrl: null,
    audioPreviewUrl: audio("DEMON CHOIR LOOP.wav"),
    waveformUrl: waveform("DEMON CHOIR LOOP.json"),
    durationSec: 35,
    bpm: 70,
    key: "Bm",
    tags: ["choir", "texture", "private"],
    accessType: "premium",
    stats: { plays: 51, likes: 7, downloads: 2, remakes: 1 },
    userState: { liked: false, downloaded: false, owned: true },
    status: "private",
    createdAt: date(12),
    updatedAt: date(3),
  },
  {
    id: "upload-4",
    type: "sample",
    title: "Processing Piano Dust",
    creator: { id: "current", username: "@you", avatarUrl: null },
    coverUrl: null,
    audioPreviewUrl: audio("piano.wav"),
    waveformUrl: waveform("piano.json"),
    durationSec: 19,
    bpm: 96,
    key: "A",
    tags: ["piano", "processing"],
    accessType: "free",
    stats: { plays: 0, likes: 0, downloads: 0, remakes: 0 },
    userState: { liked: false, downloaded: false, owned: true },
    status: "processing",
    createdAt: date(0),
    updatedAt: date(0),
  },
  {
    id: "remake-1",
    type: "remake",
    title: "Retro Vibes Night Edit",
    creator: { id: "current", username: "@you", avatarUrl: null },
    coverUrl: null,
    audioPreviewUrl: audio("BOARDS OF CANADA CHOP.wav"),
    waveformUrl: waveform("BOARDS OF CANADA CHOP.json"),
    durationSec: 44,
    bpm: 120,
    key: "Dm",
    tags: ["remake", "synth", "night"],
    accessType: "free",
    stats: { plays: 144, likes: 22, downloads: 0, remakes: 0 },
    userState: { liked: false, downloaded: false, owned: true },
    status: "draft",
    originalSample: { id: "liked-2", title: "Retro Vibes", creatorUsername: "@analogriot" },
    createdAt: date(6),
    updatedAt: date(0),
  },
  {
    id: "remake-2",
    type: "remake",
    title: "Lo-Fi Dreams Tape Flip",
    creator: { id: "current", username: "@you", avatarUrl: null },
    coverUrl: null,
    audioPreviewUrl: audio("BALI CHOP.wav"),
    waveformUrl: waveform("BALI CHOP.json"),
    durationSec: 37,
    bpm: 85,
    key: "Am",
    tags: ["remake", "lofi", "tape"],
    accessType: "free",
    stats: { plays: 502, likes: 81, downloads: 0, remakes: 0 },
    userState: { liked: true, downloaded: false, owned: true },
    status: "published",
    originalSample: { id: "liked-1", title: "Lo-Fi Dreams", creatorUsername: "@bagamemphis" },
    createdAt: date(19),
    updatedAt: date(8),
  },
  {
    id: "remake-3",
    type: "remake",
    title: "Failed Soul Flip",
    creator: { id: "current", username: "@you", avatarUrl: null },
    coverUrl: null,
    audioPreviewUrl: null,
    waveformUrl: null,
    durationSec: 0,
    bpm: null,
    key: null,
    tags: ["remake", "failed"],
    accessType: "free",
    stats: { plays: 0, likes: 0, downloads: 0, remakes: 0 },
    userState: { liked: false, downloaded: false, owned: true },
    status: "failed",
    originalSample: { id: "downloaded-2", title: "Caldera Chop", creatorUsername: "@cratediver" },
    createdAt: date(1),
    updatedAt: date(1),
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
    case "popular":
    case "most-popular":
    case "original-popularity":
      return sorted.sort((a, b) => b.stats.plays + b.stats.likes - (a.stats.plays + a.stats.likes));
    case "most-liked":
      return sorted.sort((a, b) => b.stats.likes - a.stats.likes);
    case "most-played":
      return sorted.sort((a, b) => b.stats.plays - a.stats.plays);
    case "recently-liked":
    case "recently-downloaded":
    case "newest":
    default:
      return sorted.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }
};

export const isLibraryAuthorized = () => localStorage.getItem("retrosampled:isAuthorized") !== "false";

export const getContinueWorkingItems = async (): Promise<ContinueWorkingItem[]> => {
  await new Promise((resolve) => setTimeout(resolve, 120));
  return [
    { id: "cw-remake", label: "Draft remake", title: "Retro Vibes Night Edit", href: "/remakes/remake-1/edit" },
    { id: "cw-sample", label: "Last opened", title: "Lo-Fi Dreams", href: "/samples/liked-1" },
    { id: "cw-upload", label: "Draft upload", title: "VHS Drums Pack", href: "/uploads/upload-2/edit" },
  ];
};

export const getLibraryItems = async (query: LibraryQuery): Promise<LibraryResponse> => {
  await new Promise((resolve) => setTimeout(resolve, 280));

  if (query.search?.toLowerCase() === "error") {
    throw new Error("Unable to load library");
  }

  const search = query.search?.trim().toLowerCase();
  const cursor = query.cursor ? Number(query.cursor) : 0;
  const limit = query.limit ?? 20;

  let items = tabItems[query.tab] ?? [];

  if (query.type) {
    items = items.filter((item) => item.accessType === query.type);
  }

  if (query.status) {
    items = items.filter((item) => item.status === query.status);
  }

  if (search) {
    items = items.filter((item) => getSearchText(item).includes(search));
  }

  items = sortItems(items, query.sort);

  const page = items.slice(cursor, cursor + limit);
  const next = cursor + limit < items.length ? String(cursor + limit) : null;

  return { items: page, nextCursor: next };
};
