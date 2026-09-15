import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const SEARCH_TYPES = ['all', 'samples', 'users', 'tags'] as const;

export class SearchQueryDto {
  @IsString()
  @MaxLength(120)
  q!: string;

  @IsOptional()
  @IsIn(SEARCH_TYPES)
  type?: (typeof SEARCH_TYPES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
