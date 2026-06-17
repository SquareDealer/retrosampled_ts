import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const toInt = ({ value }: { value: unknown }) =>
  value === undefined || value === '' || value === null ? undefined : Number(value);

const toTags = ({ value }: { value: unknown }) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
};

// Fields arrive as multipart/form-data strings alongside the `audio` file.
export class CreateSampleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @Transform(toTags)
  tags?: string[];

  @IsOptional()
  @Transform(toInt)
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

  @Transform(toInt)
  @IsInt()
  @Min(0)
  durationSec!: number;

  // JSON string of the client-computed waveform peaks ({ version, data, ... }).
  @IsString()
  peaks!: string;

  // Set when uploading a remake of an existing sample.
  @IsOptional()
  @IsString()
  parentId?: string;
}
