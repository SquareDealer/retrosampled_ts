import {
  Controller,
  Delete,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CreatorsService } from '../service/creators.service';
import { JwtAuthGuard, AuthenticatedRequest } from '../../auth/jwt-auth.guard';

@Controller('creators')
export class CreatorsController {
  constructor(private readonly creatorsService: CreatorsService) {}

  @Post('become')
  @UseGuards(JwtAuthGuard)
  become(@Req() req: AuthenticatedRequest) {
    return this.creatorsService.becomeCreator(req.user!.sub);
  }

  @Put(':id/follow')
  @UseGuards(JwtAuthGuard)
  follow(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.creatorsService.follow(req.user!.sub, id);
  }

  @Delete(':id/follow')
  @UseGuards(JwtAuthGuard)
  unfollow(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.creatorsService.unfollow(req.user!.sub, id);
  }
}
