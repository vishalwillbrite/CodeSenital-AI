import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { RateLimiterGuard } from '../common/guards/rate-limiter.guard';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, RateLimiterGuard],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
