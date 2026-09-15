import { SetMetadata } from '@nestjs/common';

export const OPTIONAL_AUTH_KEY = 'auth:isOptional';

/**
 * The route works for guests and for signed-in users: a valid token is attached
 * as `req.user`, an invalid or missing one is ignored instead of throwing.
 */
export const OptionalAuth = () => SetMetadata(OPTIONAL_AUTH_KEY, true);
