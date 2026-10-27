import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { RateLimiterGuard } from '../common/guards/rate-limiter.guard';

import { GithubModule } from '../github/github.module';

@Module({
  imports: [PrismaModule, AiModule, AuthModule, GithubModule],
  controllers: [ReviewsController],
  providers: [ReviewsService, RateLimiterGuard],
  exports: [ReviewsService],
})
export class ReviewsModule {}
