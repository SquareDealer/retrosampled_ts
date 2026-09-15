import {
  ArrayMaxSize,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { SAMPLE_TYPES, SampleType } from '@retrosampled/shared';
import {
  TransformNullableInt,
  TransformNullableString,
  TransformStringArray,
} from './transforms';

export const TITLE_MAX_LENGTH = 80;
export const DESCRIPTION_MAX_LENGTH = 2000;
export const MAX_TAGS = 8;
export const TAG_MAX_LENGTH = 24;
export const MAX_COLLABORATORS = 8;

/**
 * Shared by `POST /samples` (multipart: every field arrives as a string) and
 * `PATCH /samples/:id` (JSON). Nullable fields accept `null`/`""` to clear.
 */
export class SampleMetadataDto {
  @IsOptional()
  @IsString()
  @MaxLength(TITLE_MAX_LENGTH)
  title?: string;

  @IsOptional()
  @TransformNullableString()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(DESCRIPTION_MAX_LENGTH)
  description?: string | null;

  @IsOptional()
  @TransformNullableInt()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(20)
  @Max(400)
  bpm?: number | null;

  @IsOptional()
  @TransformNullableString()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(8)
  musicalKey?: string | null;

  @IsOptional()
  @TransformNullableString()
  @ValidateIf((_, value) => value !== null)
  @IsIn(SAMPLE_TYPES)
  sampleType?: SampleType | null;

  @IsOptional()
  @TransformStringArray()
  @ArrayMaxSize(MAX_TAGS)
  @IsString({ each: true })
  @MaxLength(TAG_MAX_LENGTH, { each: true })
  tags?: string[];

  @IsOptional()
  @TransformStringArray()
  @ArrayMaxSize(MAX_COLLABORATORS)
  @IsString({ each: true })
  collaboratorIds?: string[];
}

export class CreateSampleDto extends SampleMetadataDto {
  /** Present ⇒ the upload is a remake of that sample. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  parentId?: string;
}

export class UpdateSampleDto extends SampleMetadataDto {}
