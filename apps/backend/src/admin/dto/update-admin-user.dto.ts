import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { USER_ROLES, UserRole } from '@retrosampled/shared';

/** `PATCH /admin/users/:id` — both fields optional, at least one meaningful. */
export class UpdateAdminUserDto {
  @IsOptional()
  @IsIn(USER_ROLES as unknown as string[], {
    message: `role must be one of: ${USER_ROLES.join(', ')}`,
  })
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
