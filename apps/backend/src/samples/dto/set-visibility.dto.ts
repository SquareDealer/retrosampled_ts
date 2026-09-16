import { IsIn } from 'class-validator';
import { SAMPLE_VISIBILITIES, SampleVisibility } from '@retrosampled/shared';

export class SetVisibilityDto {
  @IsIn(SAMPLE_VISIBILITIES)
  status!: SampleVisibility;
}
