import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AiModule } from './ai/ai.module';
import { ReviewsModule } from './reviews/reviews.module';
import { AuthModule } from './auth/auth.module';
import { GithubModule } from './github/github.module';

@Module({
  imports: [PrismaModule, AiModule, ReviewsModule, AuthModule, GithubModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
