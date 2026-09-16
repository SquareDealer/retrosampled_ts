import { IsIn } from 'class-validator';
import { AdminVisibility } from '@retrosampled/shared';

const ADMIN_VISIBILITIES: AdminVisibility[] = ['published', 'private'];

/** `PATCH /admin/samples/:id/visibility` */
export class UpdateSampleVisibilityDto {
  @IsIn(ADMIN_VISIBILITIES, {
    message: `status must be one of: ${ADMIN_VISIBILITIES.join(', ')}`,
  })
  status!: AdminVisibility;
}
