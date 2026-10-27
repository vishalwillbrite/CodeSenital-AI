import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Res,
  Req,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { GithubService } from './github.service';
import { GithubAppService } from './github-app.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RateLimiterGuard } from '../common/guards/rate-limiter.guard';
import { GetRepositoriesQueryDto } from './dto/get-repositories-query.dto';
import { GetFileQueryDto } from './dto/get-file-query.dto';

@Controller('github')
export class GithubController {
  private readonly logger = new Logger(GithubController.name);

  constructor(
    private readonly githubService: GithubService,
    private readonly githubAppService: GithubAppService,
  ) {}

  /**
   * GET /github/status
   * Public status indicating if GitHub App is configured.
   */
  @Get('status')
  getStatus() {
    return {
      configured: this.githubAppService.isConfigured(),
      appSlug: this.githubAppService.getAppSlug(),
    };
  }

  /**
   * GET /github/connect and GET /github/connect-url
   * Generates a signed, short-lived CSRF state token and returns the GitHub App installation URL.
   */
  @Get(['connect', 'connect-url'])
  @UseGuards(AuthGuard)
  getConnectUrl(@CurrentUser() user: AuthenticatedUser) {
    return this.githubService.getConnectUrl(user.id);
  }

  /**
   * GET /github/callback
   * Handles browser redirect from GitHub App installation consent screen.
   * Validates state, verifies installation via GitHub API, and redirects to frontend.
   */
  @Get('callback')
  @UseGuards(AuthGuard)
  async handleCallback(
    @Query('installation_id') installationId: string,
    @Query('state') state: string,
    @Query('setup_action') setupAction: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const isApiRequest = req.headers.accept?.includes('application/json');

    try {
      await this.githubService.handleInstallCallback(installationId, state, user.id);
      if (isApiRequest) {
        return res.json({ success: true, message: 'Installation connected successfully' });
      }
      return res.redirect(`${frontendUrl}/?tab=repositories&installed=true`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to connect GitHub App installation.';
      this.logger.error(`GitHub App installation callback error: ${msg}`);
      if (isApiRequest) {
        throw err;
      }
      return res.redirect(
        `${frontendUrl}/?tab=repositories&auth_error=${encodeURIComponent(msg)}`,
      );
    }
  }

  /**
   * GET /github/installations
   * Lists GitHub App installations linked to the authenticated user.
   */
  @Get('installations')
  @UseGuards(AuthGuard)
  getInstallations(@CurrentUser() user: AuthenticatedUser) {
    return this.githubService.listInstallations(user.id);
  }

  /**
   * DELETE /github/installations/:id
   * Disconnects an installation and cascades removal of associated repository metadata.
   */
  @Delete('installations/:id')
  @UseGuards(AuthGuard)
  deleteInstallation(
    @Param(
      'id',
      new ParseUUIDPipe({
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
        version: '4',
      }),
    )
    id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.githubService.deleteInstallation(id, user.id);
  }

  /**
   * POST /github/installations/:id/sync
   * Manually re-syncs repositories for a connected installation.
   */
  @Post('installations/:id/sync')
  @UseGuards(AuthGuard)
  syncInstallation(
    @Param(
      'id',
      new ParseUUIDPipe({
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
        version: '4',
      }),
    )
    id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.githubService.syncUserInstallation(id, user.id);
  }

  /**
   * GET /github/repositories
   * Lists authorized repositories for the authenticated user.
   */
  @Get('repositories')
  @UseGuards(AuthGuard)
  getRepositories(
    @Query() query: GetRepositoriesQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.githubService.listRepositories(user.id, query.search, query.page, query.limit);
  }

  /**
   * GET /github/repositories/:repoId/tree
   * Returns repository file tree, excluding binary and non-code files.
   */
  @Get('repositories/:repoId/tree')
  @UseGuards(AuthGuard)
  getRepositoryTree(
    @Param(
      'repoId',
      new ParseUUIDPipe({
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
        version: '4',
      }),
    )
    repoId: string,
    @Query('ref') ref: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.githubService.getRepositoryTree(repoId, user.id, ref);
  }

  /**
   * GET /github/repositories/:repoId/file
   * Fetches validated source code file content for review.
   */
  @Get('repositories/:repoId/file')
  @UseGuards(AuthGuard)
  getFileContent(
    @Param(
      'repoId',
      new ParseUUIDPipe({
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
        version: '4',
      }),
    )
    repoId: string,
    @Query() query: GetFileQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.githubService.getFileContent(repoId, user.id, query.path, query.ref);
  }

  /**
   * GET /github/repositories/:repoId/pulls
   * Lists open pull requests for the repository.
   */
  @Get('repositories/:repoId/pulls')
  @UseGuards(AuthGuard)
  getPullRequests(
    @Param(
      'repoId',
      new ParseUUIDPipe({
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
        version: '4',
      }),
    )
    repoId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.githubService.listPullRequests(repoId, user.id);
  }

  /**
   * GET /github/repositories/:repoId/pulls/:pullNumber
   * Retrieves pull request details and changed files list.
   */
  @Get('repositories/:repoId/pulls/:pullNumber')
  @UseGuards(AuthGuard)
  getPullRequestDetails(
    @Param(
      'repoId',
      new ParseUUIDPipe({
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
        version: '4',
      }),
    )
    repoId: string,
    @Param('pullNumber', ParseIntPipe) pullNumber: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.githubService.getPullRequestDetails(repoId, user.id, pullNumber);
  }
}
