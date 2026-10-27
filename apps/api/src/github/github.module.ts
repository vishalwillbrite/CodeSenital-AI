import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { GithubController } from './github.controller';
import { GithubService } from './github.service';
import { GithubAppService } from './github-app.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [GithubController],
  providers: [GithubService, GithubAppService],
  exports: [GithubService, GithubAppService],
})
export class GithubModule {}
