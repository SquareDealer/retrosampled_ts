import { AttributionService } from './attribution.service';

type Row = { id: string; ownerId: string; parentId: string | null; rootId: string };

function buildService(rows: Row[]) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const findUnique = jest.fn(async ({ where }: { where: { id: string } }) => {
    const row = byId.get(where.id);
    return row ? { ownerId: row.ownerId } : null;
  });

  const prisma = { sample: { findUnique } };
  return { service: new AttributionService(prisma as never), findUnique };
}

const ROOT: Row = { id: 'root', ownerId: 'og', parentId: null, rootId: 'root' };
const CHILD: Row = { id: 'child', ownerId: 'mid', parentId: 'root', rootId: 'root' };
const GRANDCHILD: Row = { id: 'grand', ownerId: 'cur', parentId: 'child', rootId: 'root' };

describe('AttributionService', () => {
  it('root sample: owner is OG and current creator, no queries', async () => {
    const { service, findUnique } = buildService([ROOT]);

    await expect(service.resolve(ROOT, [])).resolves.toEqual([
      { userId: 'og', roles: ['OG_CREATOR', 'CURRENT_CREATOR'] },
    ]);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('1-deep remake: root owner is OG, owner is current, no inherited OG', async () => {
    const { service, findUnique } = buildService([ROOT, CHILD]);

    await expect(service.resolve(CHILD, [])).resolves.toEqual([
      { userId: 'og', roles: ['OG_CREATOR'] },
      { userId: 'mid', roles: ['CURRENT_CREATOR'] },
    ]);
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it('2-deep remake: parent owner becomes inherited OG', async () => {
    const { service, findUnique } = buildService([ROOT, CHILD, GRANDCHILD]);

    await expect(service.resolve(GRANDCHILD, [])).resolves.toEqual([
      { userId: 'og', roles: ['OG_CREATOR'] },
      { userId: 'mid', roles: ['INHERITED_OG_CREATOR'] },
      { userId: 'cur', roles: ['CURRENT_CREATOR'] },
    ]);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('collaborators get COLLABORATOR and roles merge per user in priority order', async () => {
    const { service } = buildService([ROOT, CHILD, GRANDCHILD]);

    // The OG creator is also credited as a collaborator on the grandchild.
    await expect(service.resolve(GRANDCHILD, ['collab', 'og'])).resolves.toEqual([
      { userId: 'og', roles: ['OG_CREATOR', 'COLLABORATOR'] },
      { userId: 'mid', roles: ['INHERITED_OG_CREATOR'] },
      { userId: 'cur', roles: ['CURRENT_CREATOR'] },
      { userId: 'collab', roles: ['COLLABORATOR'] },
    ]);
  });

  it('survives a deleted root (no OG credit rather than a crash)', async () => {
    const { service } = buildService([CHILD]);

    await expect(service.resolve(CHILD, [])).resolves.toEqual([
      { userId: 'mid', roles: ['CURRENT_CREATOR'] },
    ]);
  });
});
