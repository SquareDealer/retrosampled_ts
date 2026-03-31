export interface Profile {
  user_id: string;
  username: string;
  avatar_url?: string | null;
  bio?: string | null;
  is_creator: boolean;
  links: Record<string, string>; // jsonb
  created_at: string;
  updated_at: string;
}