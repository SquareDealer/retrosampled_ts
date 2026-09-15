import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min, MaxLength } from 'class-validator';

/**
 * `GET /admin/users?cursor&limit&q`.
 *
 * Every query field needs a property here: `forbidNonWhitelisted` is on
 * globally, so an unknown parameter is a 400 rather than a silent no-op.
 */
export class ListUsersQueryDto {
  /** Id of the last row of the previous page. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  /** Substring match on email / username / display name. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
