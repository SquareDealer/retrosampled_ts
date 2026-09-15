import {
  Action,
  Actor,
  CommentResource,
  Resource,
  SampleResource,
  UserResource,
  can,
} from './permissions';
import { SAMPLE_STATUSES, SampleStatus } from './enums';

const OWNER_ID = 'user-owner';
const OTHER_ID = 'user-other';
const ADMIN_ID = 'user-admin';
const COLLAB_ID = 'user-collab';

const GUEST: Actor = null;
const OWNER: Actor = { id: OWNER_ID, role: 'USER' };
const USER: Actor = { id: OTHER_ID, role: 'USER' };
const COLLABORATOR: Actor = { id: COLLAB_ID, role: 'USER' };
const ADMIN: Actor = { id: ADMIN_ID, role: 'ADMIN' };

const sample = (status: SampleStatus): SampleResource => ({
  kind: 'sample',
  ownerId: OWNER_ID,
  status,
  collaboratorIds: [COLLAB_ID],
});

const PUBLISHED = sample('PUBLISHED');
const DRAFT = sample('DRAFT');

/** Comment written by USER on OWNER's sample. */
const OTHERS_COMMENT: CommentResource = {
  kind: 'comment',
  authorId: OTHER_ID,
  sampleOwnerId: OWNER_ID,
};

/** Comment written by OWNER on OWNER's own sample. */
const OWN_COMMENT: CommentResource = {
  kind: 'comment',
  authorId: OWNER_ID,
  sampleOwnerId: OWNER_ID,
};

const OTHER_USER: UserResource = { kind: 'user', id: OTHER_ID };
const SELF_AS_OWNER: UserResource = { kind: 'user', id: OWNER_ID };

type Row = {
  action: Action;
  resource?: Resource;
  /** Expected answer for [guest, user, owner, admin]. */
  guest: boolean;
  user: boolean;
  owner: boolean;
  admin: boolean;
  note?: string;
};

/**
 * The D5 matrix, one row per (action, resource) pair, checked against all four
 * kinds of actor. "owner" is the owner of the sample / author of the comment /
 * the user being edited, depending on the resource.
 */
const MATRIX: Row[] = [
  // --- published sample: readable by everyone -----------------------------
  { action: 'sample:view', resource: PUBLISHED, guest: true, user: true, owner: true, admin: true },
  { action: 'sample:play', resource: PUBLISHED, guest: true, user: true, owner: true, admin: true },

  // --- non-published sample: owner + admin only ---------------------------
  { action: 'sample:view', resource: DRAFT, guest: false, user: false, owner: true, admin: true },
  { action: 'sample:play', resource: DRAFT, guest: false, user: false, owner: true, admin: true },

  // --- interacting with a published sample --------------------------------
  { action: 'sample:download', resource: PUBLISHED, guest: false, user: true, owner: true, admin: true },
  { action: 'sample:like', resource: PUBLISHED, guest: false, user: true, owner: true, admin: true },
  { action: 'sample:comment', resource: PUBLISHED, guest: false, user: true, owner: true, admin: true },
  { action: 'sample:remake', resource: PUBLISHED, guest: false, user: true, owner: true, admin: true },

  // --- interacting with a draft: only the owner (and admin) ---------------
  { action: 'sample:download', resource: DRAFT, guest: false, user: false, owner: true, admin: true },
  { action: 'sample:like', resource: DRAFT, guest: false, user: false, owner: true, admin: true },
  { action: 'sample:comment', resource: DRAFT, guest: false, user: false, owner: true, admin: true },
  { action: 'sample:remake', resource: DRAFT, guest: false, user: false, owner: true, admin: true },

  // --- creating / managing samples ----------------------------------------
  { action: 'sample:create', guest: false, user: true, owner: true, admin: true },
  { action: 'sample:edit', resource: PUBLISHED, guest: false, user: false, owner: true, admin: true },
  { action: 'sample:publish', resource: DRAFT, guest: false, user: false, owner: true, admin: true },
  { action: 'sample:delete', resource: PUBLISHED, guest: false, user: false, owner: true, admin: true },

  // --- comments ------------------------------------------------------------
  // USER wrote it: USER edits, USER + sample owner + admin delete.
  { action: 'comment:edit', resource: OTHERS_COMMENT, guest: false, user: true, owner: false, admin: true },
  { action: 'comment:delete', resource: OTHERS_COMMENT, guest: false, user: true, owner: true, admin: true },
  // OWNER wrote it on their own sample: USER can do neither.
  { action: 'comment:edit', resource: OWN_COMMENT, guest: false, user: false, owner: true, admin: true },
  { action: 'comment:delete', resource: OWN_COMMENT, guest: false, user: false, owner: true, admin: true },

  // --- users ---------------------------------------------------------------
  // Following USER: everybody signed in may, except USER themselves.
  { action: 'user:follow', resource: OTHER_USER, guest: false, user: false, owner: true, admin: true },
  { action: 'user:edit', resource: SELF_AS_OWNER, guest: false, user: false, owner: true, admin: true },

  // --- misc ----------------------------------------------------------------
  { action: 'library:view', guest: false, user: true, owner: true, admin: true },
  { action: 'admin:any', guest: false, user: false, owner: false, admin: true },
];

describe('can()', () => {
  describe('D5 matrix', () => {
    const actors: Array<[keyof Omit<Row, 'action' | 'resource' | 'note'>, Actor]> = [
      ['guest', GUEST],
      ['user', USER],
      ['owner', OWNER],
      ['admin', ADMIN],
    ];

    for (const row of MATRIX) {
      for (const [label, actor] of actors) {
        const expected = row[label];
        const resourceLabel =
          row.resource === undefined
            ? 'no resource'
            : row.resource.kind === 'sample'
              ? `${row.resource.kind}(${row.resource.status})`
              : row.resource.kind;

        it(`${label} ${expected ? 'CAN' : 'CANNOT'} ${row.action} [${resourceLabel}]`, () => {
          expect(can(actor, row.action, row.resource)).toBe(expected);
        });
      }
    }
  });

  describe('every action is covered for every actor kind', () => {
    it('touches all 16 actions', () => {
      const covered = new Set(MATRIX.map((row) => row.action));
      const allActions: Action[] = [
        'sample:view',
        'sample:play',
        'sample:download',
        'sample:like',
        'sample:comment',
        'sample:create',
        'sample:remake',
        'sample:edit',
        'sample:publish',
        'sample:delete',
        'comment:edit',
        'comment:delete',
        'user:follow',
        'user:edit',
        'library:view',
        'admin:any',
      ];

      expect([...covered].sort()).toEqual([...allActions].sort());
    });
  });

  describe('non-published statuses', () => {
    for (const status of SAMPLE_STATUSES) {
      const resource = sample(status);
      const visible = status === 'PUBLISHED';

      it(`${status}: guests ${visible ? 'see' : 'do not see'} it`, () => {
        expect(can(GUEST, 'sample:view', resource)).toBe(visible);
      });

      it(`${status}: a stranger ${visible ? 'sees' : 'does not see'} it`, () => {
        expect(can(USER, 'sample:view', resource)).toBe(visible);
      });

      it(`${status}: the owner always sees it`, () => {
        expect(can(OWNER, 'sample:view', resource)).toBe(true);
      });

      it(`${status}: an admin always sees it`, () => {
        expect(can(ADMIN, 'sample:view', resource)).toBe(true);
      });
    }
  });

  describe('collaborators', () => {
    it('may view a draft they are credited on', () => {
      expect(can(COLLABORATOR, 'sample:view', DRAFT)).toBe(true);
      expect(can(COLLABORATOR, 'sample:play', DRAFT)).toBe(true);
    });

    it('may not edit, publish or delete it', () => {
      expect(can(COLLABORATOR, 'sample:edit', DRAFT)).toBe(false);
      expect(can(COLLABORATOR, 'sample:publish', DRAFT)).toBe(false);
      expect(can(COLLABORATOR, 'sample:delete', DRAFT)).toBe(false);
    });

    it('may not download or like a draft (it is not published)', () => {
      expect(can(COLLABORATOR, 'sample:download', DRAFT)).toBe(false);
      expect(can(COLLABORATOR, 'sample:like', DRAFT)).toBe(false);
    });
  });

  describe('self-follow', () => {
    it('is refused for a plain user', () => {
      expect(can(USER, 'user:follow', { kind: 'user', id: OTHER_ID })).toBe(false);
    });

    it('is refused for an admin too (admin bypass does not apply)', () => {
      expect(can(ADMIN, 'user:follow', { kind: 'user', id: ADMIN_ID })).toBe(false);
      expect(can(ADMIN, 'user:follow', OTHER_USER)).toBe(true);
    });
  });

  describe('resource-kind mismatch fails closed', () => {
    it('refuses a comment resource for a sample action', () => {
      expect(can(ADMIN, 'sample:edit', OTHERS_COMMENT as unknown as Resource)).toBe(
        false,
      );
    });

    it('refuses a sample resource for a user action', () => {
      expect(can(ADMIN, 'user:edit', PUBLISHED as unknown as Resource)).toBe(false);
    });
  });

  describe('resource-less questions (UI affordances)', () => {
    it('lets a signed-in user see the upload / like / comment affordances', () => {
      for (const action of [
        'sample:create',
        'sample:download',
        'sample:like',
        'sample:comment',
        'sample:remake',
        'user:follow',
        'user:edit',
        'library:view',
      ] as Action[]) {
        expect(can(USER, action)).toBe(true);
        expect(can(GUEST, action)).toBe(false);
      }
    });

    it('does not promise a plain user any sample management', () => {
      expect(can(USER, 'sample:edit')).toBe(false);
      expect(can(USER, 'sample:delete')).toBe(false);
      expect(can(ADMIN, 'sample:delete')).toBe(true);
    });

    it('keeps sample:view open (the feed is public)', () => {
      expect(can(GUEST, 'sample:view')).toBe(true);
    });
  });
});
