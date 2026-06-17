import { Transform } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateSampleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsArray()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
      : value,
  )
  tags?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  bpm?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  key?: string;

  @IsOptional()
  @IsIn(['free', 'premium'])
  accessType?: 'free' | 'premium';
}
