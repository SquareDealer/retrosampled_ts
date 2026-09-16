import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'auth:isPublic';

/** Skips authentication entirely for the route (guests welcome, no `req.user`). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
