import { Request } from 'express';
import { UserRole } from '@retrosampled/shared';

/**
 * What the guards attach to the request. `sub` is kept alongside `id` because
 * the original Supabase-era controllers (and the frontend) read `sub`.
 */
export type RequestUser = {
  sub: string;
  id: string;
  email: string;
  username: string;
  role: UserRole;
};

export type AuthenticatedRequest = Request & {
  user?: RequestUser;
  token?: string;
};
