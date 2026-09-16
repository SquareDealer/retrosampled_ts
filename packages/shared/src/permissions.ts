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
 * Actions that only make sense against a sample, a comment or a user. Passing a
 * resource of the wrong kind is always a `false` (fail closed) rather than a
 * silent pass.
 */
type ResourceKind = NonNullable<Resource>['kind'];

const RESOURCE_KIND_BY_ACTION: Partial<Record<Action, ResourceKind>> = {
  'sample:view': 'sample',
  'sample:play': 'sample',
  'sample:download': 'sample',
  'sample:like': 'sample',
  'sample:comment': 'sample',
  'sample:remake': 'sample',
  'sample:edit': 'sample',
  'sample:publish': 'sample',
  'sample:delete': 'sample',
  'comment:edit': 'comment',
  'comment:delete': 'comment',
  'user:follow': 'user',
  'user:edit': 'user',
};

function isAdmin(actor: Actor): boolean {
  return actor?.role === 'ADMIN';
}

function isOwner(actor: Actor, sample: SampleResource): boolean {
  return actor !== null && actor.id === sample.ownerId;
}

function isCollaborator(actor: Actor, sample: SampleResource): boolean {
  return (
    actor !== null && (sample.collaboratorIds ?? []).some((id) => id === actor.id)
  );
}

/**
 * Anything other than PUBLISHED (DRAFT / PRIVATE / PROCESSING / FAILED) is only
 * visible to the people behind it: the owner, the credited collaborators and
 * admins. For everyone else the sample does not exist (callers turn this into a
 * 404, never a 403, so private work is not enumerable).
 */
function canViewSample(actor: Actor, sample: SampleResource): boolean {
  if (sample.status === 'PUBLISHED') {
    return true;
  }

  return isAdmin(actor) || isOwner(actor, sample) || isCollaborator(actor, sample);
}

/**
 * Interacting with a sample (download / like / comment / remake) requires a
 * signed-in actor and a sample that is actually published — or one the actor
 * owns (so you can still try your own draft) — plus the admin bypass.
 */
function canInteractWithSample(actor: Actor, sample: SampleResource): boolean {
  if (actor === null) {
    return false;
  }

  return sample.status === 'PUBLISHED' || isOwner(actor, sample) || isAdmin(actor);
}

function canManageSample(actor: Actor, sample: SampleResource): boolean {
  if (actor === null) {
    return false;
  }

  return isOwner(actor, sample) || isAdmin(actor);
}

/**
 * The single source of truth for "is this allowed?", shared by the backend
 * (`SampleAccessService`, the admin module, the comment/user services) and the
 * frontend (button gating, `RequireRole`). Hidden buttons and 403s can never
 * disagree because both sides call this function.
 *
 * Rules, in short:
 * - guests (`actor === null`) may only view/play published samples;
 * - owners may do anything to their own sample; admins may do anything at all,
 *   with one exception: nobody follows themselves;
 * - a comment may be edited by its author and deleted by its author, by the
 *   owner of the sample it sits on, or by an admin;
 * - non-published samples behave as if they did not exist for everyone but the
 *   owner, the credited collaborators and admins.
 *
 * `resource` may be omitted to ask the "can this actor ever do X?" question used
 * for UI affordances (e.g. showing an Upload button); resource-specific rules
 * then fall back to the actor-level answer.
 */
export function can(actor: Actor, action: Action, resource?: Resource): boolean {
  const expectedKind = RESOURCE_KIND_BY_ACTION[action];
  if (resource !== undefined && expectedKind !== undefined && resource.kind !== expectedKind) {
    return false;
  }

  const sample = resource?.kind === 'sample' ? resource : undefined;
  const comment = resource?.kind === 'comment' ? resource : undefined;
  const target = resource?.kind === 'user' ? resource : undefined;

  switch (action) {
    // --- reading -----------------------------------------------------------
    case 'sample:view':
    case 'sample:play':
      return sample ? canViewSample(actor, sample) : true;

    // --- interacting with someone else's sample ----------------------------
    case 'sample:download':
    case 'sample:like':
    case 'sample:comment':
    case 'sample:remake':
      return sample ? canInteractWithSample(actor, sample) : actor !== null;

    case 'sample:create':
      return actor !== null;

    // --- owning a sample ---------------------------------------------------
    case 'sample:edit':
    case 'sample:publish':
    case 'sample:delete':
      return sample ? canManageSample(actor, sample) : isAdmin(actor);

    // --- comments ----------------------------------------------------------
    case 'comment:edit':
      if (actor === null) {
        return false;
      }
      if (isAdmin(actor)) {
        return true;
      }
      // Only the author rewrites a comment; the sample owner can delete it but
      // never put different words in someone else's mouth.
      return comment ? comment.authorId === actor.id : true;

    case 'comment:delete':
      if (actor === null) {
        return false;
      }
      if (isAdmin(actor)) {
        return true;
      }
      return comment
        ? comment.authorId === actor.id || comment.sampleOwnerId === actor.id
        : true;

    // --- users -------------------------------------------------------------
    case 'user:follow':
      if (actor === null) {
        return false;
      }
      // Self-follow is impossible for everyone, admins included.
      return target ? target.id !== actor.id : true;

    case 'user:edit':
      if (actor === null) {
        return false;
      }
      return isAdmin(actor) || (target ? target.id === actor.id : true);

    case 'library:view':
      return actor !== null;

    case 'admin:any':
      return isAdmin(actor);

    default: {
      // Exhaustiveness guard: a new Action must be handled above.
      const exhaustive: never = action;
      void exhaustive;
      return false;
    }
  }
}
