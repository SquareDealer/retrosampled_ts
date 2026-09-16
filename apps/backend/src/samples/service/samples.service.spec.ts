import { UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { SamplesService, normalizeTags, titleFromFilename } from './samples.service';

const USER = { sub: 'u1', id: 'u1', email: 'u1@example.com', username: 'u1', role: 'USER' as const };

function row(id: string) {
  return {
    id,
    ownerId: 'u1',
    parentId: null,
    rootId: id,
    depth: 0,
    title: id,
    description: null,
    status: 'PUBLISHED',
    audioKey: `samples/${id}/audio.wav`,
    audioMime: 'audio/wav',
    audioSizeBytes: 10,
    coverKey: null,
    peaksKey: null,
    durationSec: 1,
    bpm: 90,
    musicalKey: 'Am',
    sampleType: 'loop',
    processingError: null,
    likesCount: 0,
    downloadsCount: 0,
    playsCount: 0,
    remakesCount: 0,
    commentsCount: 0,
    publishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    owner: { id: 'u1', username: 'u1', displayName: null, avatarKey: null },
    tags: [],
    collaborators: [],
    likes: [],
    children: [],
  };
}

function buildService(rows: ReturnType<typeof row>[]) {
  const prisma = {
    sample: {
      findMany: jest.fn(async ({ take }: { take: number; where?: unknown }) => rows.slice(0, take)),
      update: jest.fn(async () => ({})),
      updateMany: jest.fn(async () => ({ count: 1 })),
      count: jest.fn(async () => 0),
    },
    user: { findUnique: jest.fn(async () => null), updateMany: jest.fn(async () => ({})) },
    like: { findMany: jest.fn(async () => []) },
  };
  const access = { assertCan: jest.fn(), check: jest.fn() };
  const mapper = { toSample: jest.fn((r: { id: string }) => ({ id: r.id })) };
  const detail = { getDetail: jest.fn(async (id: string) => ({ id })) };
  const config = { get: jest.fn(() => undefined) };
  const notifications = { notify: jest.fn(async () => null) };
  const library = { touch: jest.fn(async () => undefined) };

  const service = new SamplesService(
    prisma as never,
    access as never,
    mapper as never,
    detail as never,
    {} as never,
    {} as never,
    {} as never,
    notifications as never,
    library as never,
    config as never,
  );

  return { service, prisma, access, detail, notifications, library };
}

describe('SamplesService.list', () => {
  it('returns a nextCursor (last row id) only when a further page exists', async () => {
    const { service, prisma } = buildService([row('a'), row('b'), row('c')]);

    const page = await service.list({ limit: 2 }, null);

    expect(prisma.sample.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
    );
    expect(page.samples.map((s) => s.id)).toEqual(['a', 'b']);
    expect(page.nextCursor).toBe('b');

    const last = await service.list({ limit: 5 }, null);
    expect(last.nextCursor).toBeUndefined();
  });

  it('passes the cursor as a keyset cursor with skip 1', async () => {
    const { service, prisma } = buildService([row('c')]);

    await service.list({ limit: 2, cursor: 'b', sort: 'popular' }, null);

    expect(prisma.sample.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: 'b' },
        skip: 1,
        orderBy: [{ likesCount: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('guests only ever see PUBLISHED rows and cannot ask for sort=liked', async () => {
    const { service, prisma } = buildService([]);

    await service.list({ tags: ['lofi', 'Chill'], bpm_min: 80, key: 'Am' }, null);

    const where = prisma.sample.findMany.mock.calls[0][0].where as { AND: unknown[] };
    expect(where.AND).toEqual(
      expect.arrayContaining([
        { status: 'PUBLISHED' },
        { tags: { some: { tag: { name: 'lofi' } } } },
        { tags: { some: { tag: { name: 'chill' } } } },
        { bpm: { gte: 80 } },
        { musicalKey: 'Am' },
      ]),
    );

    await expect(service.list({ sort: 'liked' }, null)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('author tabs: owner sees every status, strangers only PUBLISHED', async () => {
    const { service, prisma } = buildService([]);
    prisma.user.findUnique.mockResolvedValue({ id: 'author' } as never);

    await service.list({ author: 'Author', tab: 'remakes' }, { id: 'author', role: 'USER' });
    let where = prisma.sample.findMany.mock.calls[0][0].where as { AND: unknown[] };
    expect(where.AND).toEqual([{ ownerId: 'author' }, { parentId: { not: null } }]);

    await service.list({ author: 'author', tab: 'uploads' }, null);
    where = prisma.sample.findMany.mock.calls[1][0].where as { AND: unknown[] };
    expect(where.AND).toEqual([{ ownerId: 'author' }, { parentId: null }, { status: 'PUBLISHED' }]);

    prisma.user.findUnique.mockResolvedValue(null as never);
    await expect(service.list({ author: 'ghost' }, null)).resolves.toEqual({ samples: [] });
  });
});

describe('SamplesService.setVisibility', () => {
  it('rejects publishing an incomplete sample with 422 and the list of problems', async () => {
    const { service, access } = buildService([]);
    access.assertCan.mockResolvedValue({
      ...row('s'),
      status: 'DRAFT',
      durationSec: null,
      bpm: null,
      musicalKey: null,
      title: ' ',
      collaboratorIds: [],
    });

    const error = await service.setVisibility(USER, 's', 'published').catch((e) => e);

    expect(error).toBeInstanceOf(UnprocessableEntityException);
    expect(error.getResponse().message).toEqual([
      'Audio is not processed yet',
      'Title is required',
      'BPM is required',
      'Key is required',
    ]);
  });

  it('publishes a complete draft, stamps publishedAt once and recomputes counters', async () => {
    const { service, access, prisma, detail } = buildService([]);
    access.assertCan.mockResolvedValue({
      ...row('s'),
      status: 'DRAFT',
      publishedAt: null,
      collaboratorIds: [],
    });

    await service.setVisibility(USER, 's', 'published');

    expect(prisma.sample.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PUBLISHED', publishedAt: expect.any(Date) }),
      }),
    );
    expect(prisma.user.updateMany).toHaveBeenCalled();
    expect(detail.getDetail).toHaveBeenCalledWith('s', { id: 'u1', role: 'USER' });
  });

  it('refuses to change visibility while processing or after a failure', async () => {
    const { service, access } = buildService([]);
    access.assertCan.mockResolvedValue({ ...row('s'), status: 'PROCESSING', collaboratorIds: [] });

    await expect(service.setVisibility(USER, 's', 'private')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });
});

describe('helpers', () => {
  it('normalizeTags lower-cases, trims, de-duplicates and hyphenates', () => {
    expect(normalizeTags([' Lo-Fi', 'lo-fi', 'Boom Bap', ''])).toEqual(['lo-fi', 'boom-bap']);
    expect(normalizeTags(undefined)).toBeUndefined();
  });

  it('titleFromFilename strips the extension and separators', () => {
    expect(titleFromFilename('drum_break-94.wav')).toBe('drum break 94');
    expect(titleFromFilename('.wav')).toBe('untitled sample');
  });
});
