import { Module } from '@nestjs/common';
import { AuthController } from './controller/auth.controller';
import { AuthService } from './service/auth.service';
import { TokenService } from './service/token.service';
import { MailService } from './service/mail.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OptionalAuthGuard } from './optional-auth.guard';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    MailService,
    JwtAuthGuard,
    OptionalAuthGuard,
  ],
  exports: [TokenService, JwtAuthGuard, OptionalAuthGuard],
})
export class AuthModule {}
