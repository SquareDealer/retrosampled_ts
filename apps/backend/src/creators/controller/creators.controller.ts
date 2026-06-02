import { Controller, Post, Req, UseGuards } from '@nestjs/common';
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
}
