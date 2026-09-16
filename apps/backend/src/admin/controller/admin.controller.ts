import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { AdminSampleDto, AdminUserDto, AdminUsersResponse } from '@retrosampled/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestUser } from '../../common/types/authenticated-request';
import { ListUsersQueryDto } from '../dto/list-users-query.dto';
import { UpdateAdminUserDto } from '../dto/update-admin-user.dto';
import { UpdateSampleVisibilityDto } from '../dto/update-sample-visibility.dto';
import { AdminService } from '../service/admin.service';

/**
 * Moderation surface. `@Roles('ADMIN')` sits on the class, so the global
 * `RolesGuard` answers 401 for guests and 403 for signed-in non-admins on every
 * route below — no per-handler decoration needed.
 */
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  listUsers(@Query() query: ListUsersQueryDto): Promise<AdminUsersResponse> {
    return this.adminService.listUsers(query);
  }

  @Patch('users/:id')
  updateUser(
    @CurrentUser() actor: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateAdminUserDto,
  ): Promise<AdminUserDto> {
    return this.adminService.updateUser(actor, id, dto);
  }

  @Delete('samples/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSample(
    @CurrentUser() actor: RequestUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.adminService.deleteSample(actor, id);
  }

  @Patch('samples/:id/visibility')
  setSampleVisibility(
    @CurrentUser() actor: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateSampleVisibilityDto,
  ): Promise<AdminSampleDto> {
    return this.adminService.setSampleVisibility(actor, id, dto.status);
  }

  @Delete('comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteComment(
    @CurrentUser() actor: RequestUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.adminService.deleteComment(actor, id);
  }
}
