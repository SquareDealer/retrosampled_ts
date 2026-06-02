import { Transform } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

const toInt = ({ value }: { value: unknown }) =>
  value === undefined || value === '' ? undefined : Number(value);

export class QuerySamplesDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsArray()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.split(',').map((t) => t.trim()).filter(Boolean)
      : value,
  )
  tags?: string[];

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(0)
  bpm_min?: number;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(0)
  bpm_max?: number;

  @IsOptional()
  @IsString()
  key?: string;

  @IsOptional()
  @IsIn(['free', 'premium'])
  type?: 'free' | 'premium';

  @IsOptional()
  @IsIn(['newest', 'popular', 'liked', 'remakes'])
  sort?: 'newest' | 'popular' | 'liked' | 'remakes';

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(1)
  limit?: number;
}
