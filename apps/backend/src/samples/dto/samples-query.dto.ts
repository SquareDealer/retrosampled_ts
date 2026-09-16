import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  SAMPLES_AUTHOR_TABS,
  SAMPLES_SORTS,
  SamplesAuthorTab,
  SamplesSort,
} from '@retrosampled/shared';
import { TransformStringArray } from './transforms';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

/**
 * `GET /samples` query. Mirrors the frontend `FetchSamplesQuery` (minus the
 * removed `type`) plus `author`/`tab` so the profile page can ask for
 * `?author=southkid&tab=uploads`.
 */
export class SamplesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @TransformStringArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  bpm_min?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  bpm_max?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  key?: string;

  @IsOptional()
  @IsIn(SAMPLES_SORTS)
  sort?: SamplesSort;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  author?: string;

  @IsOptional()
  @IsIn(SAMPLES_AUTHOR_TABS)
  tab?: SamplesAuthorTab;
}
