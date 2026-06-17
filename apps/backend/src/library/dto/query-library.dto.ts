import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class QueryLibraryDto {
  @IsOptional()
  @IsIn(['liked', 'downloaded', 'uploads', 'remakes'])
  tab?: 'liked' | 'downloaded' | 'uploads' | 'remakes';

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsIn(['draft', 'published', 'private', 'processing', 'failed'])
  status?: 'draft' | 'published' | 'private' | 'processing' | 'failed';

  @IsOptional()
  @IsIn(['free', 'premium'])
  type?: 'free' | 'premium';

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  limit?: number;
}
