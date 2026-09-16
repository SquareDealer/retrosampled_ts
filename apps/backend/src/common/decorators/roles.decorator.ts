import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@retrosampled/shared';

export const ROLES_KEY = 'auth:roles';

/** Restricts the route to the listed account roles (enforced by RolesGuard). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
