import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export const COMMENT_SORTS = ['newest', 'oldest', 'most-liked'] as const;
export type CommentSort = (typeof COMMENT_SORTS)[number];

export class ListCommentsQueryDto {
  @IsOptional()
  @IsIn(COMMENT_SORTS)
  sort?: CommentSort;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text!: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}

export class UpdateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text!: string;
}
