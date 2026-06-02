import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { PrismaService } from '../../prisma/prisma.service';

const prisma = {
  profile: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
} as unknown as PrismaService;

const sampleProfile = {
  userId: 'user-1',
  username: 'alice',
  avatarUrl: null,
  bio: 'hi',
  isCreator: true,
  links: { site: 'https://a.dev' },
};

describe('ProfileService', () => {
  let service: ProfileService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ProfileService(prisma);
  });

  it('maps a profile to the response DTO', async () => {
    (prisma.profile.findUnique as jest.Mock).mockResolvedValue(sampleProfile);
    await expect(service.getProfileById('user-1')).resolves.toEqual({
      userId: 'user-1',
      username: 'alice',
      avatarUrl: null,
      bio: 'hi',
      isCreator: true,
      links: { site: 'https://a.dev' },
    });
  });

  it('throws NotFound when the profile is missing', async () => {
    (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(service.getProfileByUsername('ghost')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects an update that would take another user’s username', async () => {
    (prisma.profile.findFirst as jest.Mock).mockResolvedValue({
      userId: 'user-2',
    });
    await expect(
      service.updateProfile('user-1', { username: 'taken' }),
    ).rejects.toThrow(/already taken/);
    expect(prisma.profile.update).not.toHaveBeenCalled();
  });

  it('updates only the provided fields', async () => {
    (prisma.profile.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.profile.update as jest.Mock).mockResolvedValue({
      ...sampleProfile,
      bio: 'updated',
    });

    const result = await service.updateProfile('user-1', { bio: 'updated' });
    expect(result.bio).toBe('updated');
    expect(prisma.profile.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { bio: 'updated' },
    });
  });
});
