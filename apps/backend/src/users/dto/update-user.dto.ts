import {
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(16)
  @Matches(/^[a-z0-9_]+$/i, {
    message: 'username may only contain letters, digits and underscores',
  })
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsObject()
  links?: Record<string, string>;
}
