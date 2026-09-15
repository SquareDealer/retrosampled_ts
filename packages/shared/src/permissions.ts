import type { SampleStatus, UserRole } from './enums';

export type Action =
  | 'sample:view'
  | 'sample:play'
  | 'sample:download'
  | 'sample:like'
  | 'sample:comment'
  | 'sample:create'
  | 'sample:remake'
  | 'sample:edit'
  | 'sample:publish'
  | 'sample:delete'
  | 'comment:edit'
  | 'comment:delete'
  | 'user:follow'
  | 'user:edit'
  | 'library:view'
  | 'admin:any';

/** `null` means guest. */
export type Actor = { id: string; role: UserRole } | null;

export type SampleResource = {
  kind: 'sample';
  ownerId: string;
  status: SampleStatus;
  collaboratorIds?: string[];
};

export type CommentResource = {
  kind: 'comment';
  authorId: string;
  sampleOwnerId: string;
};

export type UserResource = {
  kind: 'user';
  id: string;
};

export type Resource = SampleResource | CommentResource | UserResource | undefined;

/**
 * STUB — Task 1 ships the signature and a permissive placeholder so callers can
 * already be written against it. Task 2 replaces the body with the real matrix
 * (owner/admin/status rules) from the plan; the signature will not change.
 */
export function can(actor: Actor, action: Action, _resource?: Resource): boolean {
  void _resource;

  if (action === 'sample:view' || action === 'sample:play') {
    return true;
  }

  if (action === 'admin:any') {
    return actor?.role === 'ADMIN';
  }

  return actor !== null;
}
