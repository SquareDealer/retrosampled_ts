import { IsOptional, IsString, MaxLength } from 'class-validator';
import { TITLE_MAX_LENGTH } from './sample-metadata.dto';

export class CreateRemakeDto {
  @IsOptional()
  @IsString()
  @MaxLength(TITLE_MAX_LENGTH)
  title?: string;
}
