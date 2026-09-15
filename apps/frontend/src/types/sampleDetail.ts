/**
 * Re-export shim: the real definitions live in `@retrosampled/shared`.
 * Task 3.2 deletes this file once every importer points at the package.
 */
export type {
  CreatorRole,
  CreatorStats,
  CreatorViewModel,
  CommentsSortOption,
  InheritedSampleRef,
  RelatedSamplesTree,
  SampleAuthor,
  SampleComment,
  SampleCommentUser,
  SampleCommentsResponse,
  SampleDetail,
  SampleShort,
} from "@retrosampled/shared";

export { CREATOR_ROLE_PRIORITY } from "@retrosampled/shared";
