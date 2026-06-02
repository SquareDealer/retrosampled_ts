import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { CreatorsService } from './creators.service';
import { PrismaService } from '../../prisma/prisma.service';

const prisma = {
  profile: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
} as unknown as PrismaService;

describe('CreatorsService', () => {
  let service: CreatorsService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new CreatorsService(prisma);
  });

  it('rejects when no user id is provided', async () => {
    await expect(service.becomeCreator('')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects when the profile does not exist', async () => {
    (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(service.becomeCreator('user-1')).rejects.toThrow(
      /Сначала создай профиль/,
    );
  });

  it('rejects when the profile is incomplete', async () => {
    (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
      userId: 'user-1',
      username: 'alice',
      bio: null,
    });
    await expect(service.becomeCreator('user-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('promotes a complete profile to creator', async () => {
    (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
      userId: 'user-1',
      username: 'alice',
      bio: 'hello',
      isCreator: false,
    });
    (prisma.profile.update as jest.Mock).mockResolvedValue({ isCreator: true });

    await expect(service.becomeCreator('user-1')).resolves.toEqual({
      isCreator: true,
    });
    expect(prisma.profile.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { isCreator: true },
    });
  });
});
