export class ProfileResponseDto {
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  isCreator: boolean;
  links: Record<string, string>;

  constructor(partial?: Partial<ProfileResponseDto>) {
    if (partial) {
      Object.assign(this, partial);
    }
  }
}
