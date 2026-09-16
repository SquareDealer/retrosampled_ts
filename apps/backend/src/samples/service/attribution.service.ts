import { Injectable } from '@nestjs/common';
import { CREATOR_ROLE_PRIORITY, CreatorRole } from '@retrosampled/shared';
import { PrismaService } from '../../prisma/prisma.service';

export type AttributionEntry = {
  userId: string;
  /** Sorted by `CREATOR_ROLE_PRIORITY`. */
  roles: CreatorRole[];
};

export type AttributionSource = {
  id: string;
  ownerId: string;
  parentId: string | null;
  rootId: string;
};

const PRIORITY = new Map(CREATOR_ROLE_PRIORITY.map((role, index) => [role, index]));

export function sortRoles(roles: Iterable<CreatorRole>): CreatorRole[] {
  return Array.from(new Set(roles)).sort(
    (a, b) => (PRIORITY.get(a) ?? 99) - (PRIORITY.get(b) ?? 99),
  );
}

/**
 * Derives the attribution roles of a sample from the real parent chain (D1):
 *
 * - `OG_CREATOR` — owner of the root of the remake tree;
 * - `INHERITED_OG_CREATOR` — owner of the direct parent when the parent is not
 *   the root (i.e. the sample is at least two levels deep);
 * - `CURRENT_CREATOR` — the owner;
 * - `COLLABORATOR` — every `SampleCollaborator` row.
 *
 * Roles are merged per user and ordered by priority. Two `findUnique` calls at
 * most, no recursion.
 */
@Injectable()
export class AttributionService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    sample: AttributionSource,
    collaboratorIds: string[],
  ): Promise<AttributionEntry[]> {
    const rolesByUser = new Map<string, Set<CreatorRole>>();
    const add = (userId: string | null | undefined, role: CreatorRole) => {
      if (!userId) return;
      const roles = rolesByUser.get(userId) ?? new Set<CreatorRole>();
      roles.add(role);
      rolesByUser.set(userId, roles);
    };

    const parentId = sample.parentId;

    if (!parentId || sample.rootId === sample.id) {
      add(sample.ownerId, 'OG_CREATOR');
    } else {
      const root = await this.prisma.sample.findUnique({
        where: { id: sample.rootId },
        select: { ownerId: true },
      });
      add(root?.ownerId, 'OG_CREATOR');

      if (parentId !== sample.rootId) {
        const parent = await this.prisma.sample.findUnique({
          where: { id: parentId },
          select: { ownerId: true },
        });
        add(parent?.ownerId, 'INHERITED_OG_CREATOR');
      }
    }

    add(sample.ownerId, 'CURRENT_CREATOR');

    for (const collaboratorId of collaboratorIds) {
      add(collaboratorId, 'COLLABORATOR');
    }

    return Array.from(rolesByUser.entries())
      .map(([userId, roles]) => ({ userId, roles: sortRoles(roles) }))
      .sort((a, b) => (PRIORITY.get(a.roles[0]) ?? 99) - (PRIORITY.get(b.roles[0]) ?? 99));
  }
}
