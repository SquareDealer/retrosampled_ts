# Library Backend Spec

## Purpose

Library is the authenticated user's personal workspace for saved, downloaded, uploaded, and remade samples. It is not a discovery feed. The backend should return only content related to the current user and support management flows for owned uploads and remakes.

## Route

```txt
/library
```

Supported URL query state:

```txt
/library?tab=uploads&status=draft&sort=newest&search=drums
```

Supported params:

```ts
type LibraryUrlState = {
  tab?: 'liked' | 'downloaded' | 'uploads' | 'remakes';
  search?: string;
  sort?: string;
  status?: 'draft' | 'published' | 'private' | 'processing' | 'failed';
  type?: 'free' | 'premium';
  view?: 'list';
};
```

Only active params are included. Default tab is `liked`, default view is `list`.

## Auth

All Library item endpoints require an authenticated user.

Unauthenticated response:

```txt
401 Unauthorized
```

```ts
type ApiError = {
  code: 'UNAUTHORIZED' | 'INVALID_QUERY' | 'INTERNAL_ERROR';
  message: string;
};
```

The frontend sends cookie credentials with requests, so backend auth should support session cookies.

## Get Library Items

```txt
GET /library/items
```

### Query

```ts
type LibraryTab = 'liked' | 'downloaded' | 'uploads' | 'remakes';

type LibraryQuery = {
  tab: LibraryTab;
  search?: string;
  sort?: string;
  status?: 'draft' | 'published' | 'private' | 'processing' | 'failed';
  type?: 'free' | 'premium';
  cursor?: string;
  limit?: number;
};
```

Defaults:

- `tab`: `liked`
- `limit`: `20`
- `cursor`: omitted for first page
- `sort`: tab-specific default

### Tab Sorts

Liked:

- `recently-liked`
- `most-popular`
- `newest`

Downloaded:

- `recently-downloaded`
- `newest`
- `most-popular`

Uploads:

- `newest`
- `most-played`
- `most-liked`

Remakes:

- `newest`
- `most-liked`
- `original-popularity`

### Tab Filters

Downloaded supports:

```ts
type?: 'free' | 'premium';
```

Uploads supports:

```ts
status?: 'draft' | 'published' | 'private' | 'processing' | 'failed';
```

Remakes supports:

```ts
status?: 'draft' | 'published' | 'private';
```

Liked has no extra filter in MVP.

### Search

Search is scoped to the active tab only.

Search should match:

- title
- creator username
- tags
- bpm
- key
- original sample title for remakes
- original creator username for remakes

### Response

```ts
type LibraryResponse = {
  items: LibraryItem[];
  nextCursor: string | null;
};
```

```ts
type LibraryItem = {
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

  accessType: 'free' | 'premium';

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

  status?: 'draft' | 'published' | 'private' | 'processing' | 'failed';

  originalSample?: {
    id: string;
    title: string;
    creatorUsername: string;
  };

  createdAt: string;
  updatedAt: string;
};
```

### Item Rules By Tab

Liked:

- Return samples liked by current user.
- `userState.liked` should be `true`.
- Sort default should use like timestamp, not sample creation date.

Downloaded:

- Return samples downloaded by current user.
- `userState.downloaded` should be `true`.
- Sort default should use download timestamp.

Uploads:

- Return samples owned by current user.
- `type` should be `sample`.
- `userState.owned` should be `true`.
- Include `status` for every item.

Remakes:

- Return remakes owned by current user.
- `type` should be `remake`.
- `userState.owned` should be `true`.
- Include `status` and `originalSample` for every item.

## Continue Working

```txt
GET /library/continue-working
```

Returns up to 3 unfinished or recently used items.

```ts
type ContinueWorkingResponse = {
  items: ContinueWorkingItem[];
};

type ContinueWorkingItem = {
  id: string;
  label: string;
  title: string;
  href: string;
};
```

Examples:

- `Draft remake: Retro Vibes`
- `Last opened: Lo-Fi Dreams`
- `Draft upload: VHS Drums Pack`

If there is no activity, return an empty array.

## Cursor Pagination

Requirements:

- Initial load requests `limit=20`.
- Cursor must be opaque to the frontend.
- Cursor must preserve active tab, filters, search, sort, and stable tie-breaker.
- Return `nextCursor: null` when no more data exists.
- Changing `tab`, `search`, `sort`, `status`, or `type` resets pagination.

## Upload Status Semantics

Draft:

- Not visible to other users.
- Can be edited or deleted.
- Can be published after required fields are complete.

Published:

- Visible in Feed, profile, and direct link.
- Can be edited.
- Can be switched to private.

Private:

- Visible only to owner.
- Can be switched back to published.

Processing:

- Audio file is being processed.
- Play and publish actions should be disabled.
- Frontend shows processing state.

Failed:

- Upload or audio processing failed.
- Frontend shows retry and delete actions.

## Suggested Action Endpoints

The current page renders basic actions. These should become persistent through backend endpoints.

### Like / Unlike

```txt
PUT /samples/:sampleId/like
DELETE /samples/:sampleId/like
```

### Download Again

```txt
POST /samples/:sampleId/downloads
```

Response should include a signed download URL or a redirect URL if downloads are protected.

### Create Remake Draft

```txt
POST /samples/:sampleId/remakes
```

Creates a draft remake for the current user.

### Update Visibility

```txt
PATCH /samples/:sampleId/visibility
PATCH /remakes/:remakeId/visibility
```

```ts
type VisibilityRequest = {
  status: 'published' | 'private';
};
```

### Delete Owned Content

```txt
DELETE /samples/:sampleId
DELETE /remakes/:remakeId
```

Only the owner can delete.

### Retry Failed Processing

```txt
POST /samples/:sampleId/retry-processing
POST /remakes/:remakeId/retry-processing
```

Only valid for `failed` items.

## MVP Backend Checklist

- Implement `GET /library/items` for all four tabs.
- Implement `GET /library/continue-working`.
- Enforce auth for all Library endpoints.
- Support tab-scoped search.
- Support tab-specific sort and filters.
- Support cursor pagination with `limit=20`.
- Return statuses for uploads and remakes.
- Return `originalSample` data for remakes.
- Implement persistent action endpoints for like, download, visibility, delete, and retry.
