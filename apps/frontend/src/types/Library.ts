/**
 * Re-export shim: the real definitions live in `@retrosampled/shared`.
 * `LibraryAccessType` and the `type` (free/premium) filter are gone — the
 * platform is free. Task 3.2 deletes this file.
 */
export type {
  ContinueWorkingItem,
  LibraryItem,
  LibraryQuery,
  LibraryResponse,
  LibraryStatus,
  LibraryTab,
} from "@retrosampled/shared";
