import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  @Matches(/^[a-z0-9_]+$/i, {
    message: 'username may only contain letters, digits and underscores',
  })
  username?: string;
}
