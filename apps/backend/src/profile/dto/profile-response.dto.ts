export class ProfileResponseDto {
  userId: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  links: Record<string, string>;
  
  constructor(partial: Partial<ProfileResponseDto>) {
    Object.assign(this, partial);
  }
}