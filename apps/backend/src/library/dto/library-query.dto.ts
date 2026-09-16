import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { LIBRARY_STATUSES, LIBRARY_TABS, LibraryStatus, LibraryTab } from '@retrosampled/shared';

/**
 * `GET /library/items` query. `type` (free/premium) and `accessType` are gone:
 * the platform is free, so an unknown `type` param is rejected by the global
 * `forbidNonWhitelisted` pipe.
 */
export class LibraryQueryDto {
  @IsOptional()
  @IsIn(LIBRARY_TABS)
  tab?: LibraryTab;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsIn(LIBRARY_STATUSES)
  status?: LibraryStatus;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
