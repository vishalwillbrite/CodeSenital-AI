import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import { GithubAppService } from './github-app.service';
import {
  sanitizeRepoPath,
  isBinaryFile,
  isEligibleCodeFile,
  detectLanguageFromPath,
} from './github-path.util';
import type {
  GitHubApiInstallation,
  GitHubApiRepository,
  GitHubTreeNode,
  GitHubPullRequest,
  GitHubPullRequestFile,
  RepositoryFileContent,
} from './github.types';
import { MAX_SOURCE_CODE_LENGTH } from '../reviews/dto/create-review.dto';

const CONNECT_STATE_PURPOSE = 'github_app_connect';

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubAppService: GithubAppService,
  ) {}

  /**
   * Generates a signed, short-lived CSRF state token bound to the authenticated user
   * and returns the GitHub App installation URL.
   */
  getConnectUrl(userId: string): { url: string } {
    if (!this.githubAppService.isConfigured()) {
      throw new ServiceUnavailableException(
        'GitHub App is not configured. Please configure GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY in .env.',
      );
    }

    const jwtSecret = process.env.JWT_SECRET || 'codesentinel_dev_secret_key_change_in_production_32chars';
    const stateToken = jwt.sign(
      { sub: userId, purpose: CONNECT_STATE_PURPOSE },
      jwtSecret,
      { expiresIn: '10m', algorithm: 'HS256' },
    );

    const appSlug = this.githubAppService.getAppSlug();
    const url = `https://github.com/apps/${appSlug}/installations/new?state=${encodeURIComponent(stateToken)}`;

    return { url };
  }

  /**
   * Validates state, confirms installation via GitHub API, and registers the installation
   * and authorized repositories under the authenticated local user's ownership.
   */
  async handleInstallCallback(installationId: string, state: string, currentUserId: string) {
    if (!installationId || !state) {
      throw new BadRequestException('Missing installation_id or state parameter from GitHub.');
    }

    // 1. Validate state token bound to initiating user
    const jwtSecret = process.env.JWT_SECRET || 'codesentinel_dev_secret_key_change_in_production_32chars';
    let decoded: { sub: string; purpose: string };
    try {
      decoded = jwt.verify(state, jwtSecret, { algorithms: ['HS256'] }) as {
        sub: string;
        purpose: string;
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired installation state token. Please initiate connection again.');
    }

    if (decoded.sub !== currentUserId || decoded.purpose !== CONNECT_STATE_PURPOSE) {
      this.logger.error('Installation state mismatch detected (possible CSRF attempt or user session switch)');
      throw new UnauthorizedException('Installation state does not match the active session.');
    }

    // 2. Query GitHub API with App JWT to verify installation existence and details
    const installData = await this.githubAppService.requestAsApp<GitHubApiInstallation>(
      `/app/installations/${installationId}`,
    );

    if (!installData || !installData.id) {
      throw new NotFoundException(`Installation '${installationId}' could not be verified with GitHub.`);
    }

    // 3. Upsert GithubInstallation record associated with the authenticated user
    const installationRecord = await this.prisma.githubInstallation.upsert({
      where: { installationId: String(installData.id) },
      update: {
        userId: currentUserId,
        accountLogin: installData.account.login,
        accountType: installData.account.type,
        targetId: String(installData.target_id || installData.account.id),
      },
      create: {
        installationId: String(installData.id),
        userId: currentUserId,
        accountLogin: installData.account.login,
        accountType: installData.account.type,
        targetId: String(installData.target_id || installData.account.id),
      },
    });

    // 4. Fetch authorized repositories from GitHub and sync them locally
    await this.syncInstallationRepositories(installationRecord.id, String(installData.id));

    this.logger.log(
      `Successfully linked GitHub App installation '${installationId}' to user '${currentUserId}'`,
    );

    return {
      success: true,
      installationId: installationRecord.id,
      account: installData.account.login,
    };
  }

  /**
   * Syncs repositories accessible by the given installation.
   */
  async syncInstallationRepositories(installationDbId: string, githubInstallationId: string) {
    try {
      const data = await this.githubAppService.requestAsInstallation<{
        repositories: GitHubApiRepository[];
      }>(githubInstallationId, '/installation/repositories?per_page=100');

      const repos = data.repositories || [];

      for (const repo of repos) {
        await this.prisma.githubRepository.upsert({
          where: { fullName: repo.full_name },
          update: {
            installationId: installationDbId,
            githubRepoId: String(repo.id),
            owner: repo.owner.login,
            name: repo.name,
            isPrivate: repo.private,
            defaultBranch: repo.default_branch || 'main',
            htmlUrl: repo.html_url,
            description: repo.description,
          },
          create: {
            installationId: installationDbId,
            githubRepoId: String(repo.id),
            owner: repo.owner.login,
            name: repo.name,
            fullName: repo.full_name,
            isPrivate: repo.private,
            defaultBranch: repo.default_branch || 'main',
            htmlUrl: repo.html_url,
            description: repo.description,
          },
        });
      }
    } catch (err: unknown) {
      this.logger.error(
        `Failed to sync repositories for installation '${githubInstallationId}': ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Lists GitHub App installations belonging strictly to the authenticated user.
   */
  async listInstallations(userId: string) {
    return this.prisma.githubInstallation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { repositories: true },
        },
      },
    });
  }

  /**
   * Manually re-syncs repositories for a user's GitHub App installation.
   */
  async syncUserInstallation(installationDbId: string, userId: string) {
    const existing = await this.prisma.githubInstallation.findFirst({
      where: { id: installationDbId, userId },
    });

    if (!existing) {
      throw new NotFoundException(`Installation '${installationDbId}' not found.`);
    }

    await this.syncInstallationRepositories(existing.id, existing.installationId);
    return { success: true, message: 'Repositories synchronized successfully' };
  }

  /**
   * Disconnects an installation belonging to the authenticated user.
   */
  async deleteInstallation(installationId: string, userId: string) {
    const existing = await this.prisma.githubInstallation.findFirst({
      where: { id: installationId, userId },
    });

    if (!existing) {
      throw new NotFoundException(`Installation '${installationId}' not found.`);
    }

    this.githubAppService.evictToken(existing.installationId);
    await this.prisma.githubInstallation.delete({
      where: { id: existing.id },
    });

    return { message: 'Installation successfully disconnected.' };
  }

  /**
   * Lists authorized repositories for the authenticated user with optional search and pagination.
   */
  async listRepositories(userId: string, search?: string, page = 1, limit = 20) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (p - 1) * l;

    const where = {
      installation: { userId },
      ...(search
        ? {
            fullName: {
              contains: search.trim(),
              mode: 'insensitive' as const,
            },
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.githubRepository.count({ where }),
      this.prisma.githubRepository.findMany({
        where,
        orderBy: { fullName: 'asc' },
        skip,
        take: l,
        include: {
          installation: {
            select: { accountLogin: true, accountType: true },
          },
        },
      }),
    ]);

    return {
      items,
      meta: {
        total,
        page: p,
        limit: l,
        totalPages: Math.ceil(total / l) || 1,
      },
    };
  }

  /**
   * Retrieves the repository file tree, enforcing server-side user ownership,
   * excluding binary files, and filtering to reviewable source code.
   */
  async getRepositoryTree(repoId: string, userId: string, ref?: string) {
    const repo = await this.getVerifiedRepository(repoId, userId);
    const targetRef = ref?.trim() || repo.defaultBranch || 'main';

    const data = await this.githubAppService.requestAsInstallation<{
      sha: string;
      tree: GitHubTreeNode[];
      truncated: boolean;
    }>(
      repo.installation.installationId,
      `/repos/${repo.fullName}/git/trees/${encodeURIComponent(targetRef)}?recursive=1`,
    );

    // Filter out .git, binary files, and common non-code build artifacts
    const filteredTree = (data.tree || []).filter((node) => {
      if (node.path.startsWith('.git/')) return false;
      if (node.type === 'blob') {
        return !isBinaryFile(node.path);
      }
      return true;
    });

    return {
      repository: {
        id: repo.id,
        fullName: repo.fullName,
        defaultBranch: repo.defaultBranch,
      },
      ref: targetRef,
      commitSha: data.sha,
      isTruncated: data.truncated || false,
      tree: filteredTree,
    };
  }

  /**
   * Retrieves file content from repository for review, enforcing path traversal sanitization,
   * binary rejection, and maximum character length limits.
   */
  async getFileContent(
    repoId: string,
    userId: string,
    rawPath: string,
    ref?: string,
  ): Promise<RepositoryFileContent> {
    const repo = await this.getVerifiedRepository(repoId, userId);
    const cleanPath = sanitizeRepoPath(rawPath);

    if (isBinaryFile(cleanPath)) {
      throw new BadRequestException(`File '${cleanPath}' is a binary file and cannot be reviewed.`);
    }

    const targetRef = ref?.trim() || repo.defaultBranch || 'main';

    const data = await this.githubAppService.requestAsInstallation<{
      type: string;
      size: number;
      name: string;
      path: string;
      sha: string;
      content: string;
      encoding: string;
    }>(
      repo.installation.installationId,
      `/repos/${repo.fullName}/contents/${encodeURIComponent(cleanPath)}?ref=${encodeURIComponent(targetRef)}`,
    );

    if (data.type !== 'file' || !data.content) {
      throw new BadRequestException(`Target path '${cleanPath}' is not a regular file.`);
    }

    // Decode base64 file content from GitHub
    let textContent = '';
    if (data.encoding === 'base64') {
      textContent = Buffer.from(data.content, 'base64').toString('utf8');
    } else {
      textContent = data.content;
    }

    // Safety check: null bytes indicate binary file masquerading as text
    if (textContent.includes('\0')) {
      throw new BadRequestException(`File '${cleanPath}' contains binary data and cannot be reviewed.`);
    }

    // Size check against configured limit (default 64 KB = 65,536 characters)
    let isTruncated = false;
    if (textContent.length > MAX_SOURCE_CODE_LENGTH) {
      this.logger.warn(
        `File '${cleanPath}' (${textContent.length} chars) exceeds MAX_SOURCE_CODE_LENGTH (${MAX_SOURCE_CODE_LENGTH} chars); truncating.`,
      );
      textContent = textContent.slice(0, MAX_SOURCE_CODE_LENGTH);
      isTruncated = true;
    }

    const language = detectLanguageFromPath(cleanPath);

    return {
      path: cleanPath,
      language,
      size: data.size,
      content: textContent,
      commitSha: data.sha,
      isTruncated,
    };
  }

  /**
   * Lists open pull requests for the repository, strictly verifying ownership.
   */
  async listPullRequests(repoId: string, userId: string) {
    const repo = await this.getVerifiedRepository(repoId, userId);

    const prs = await this.githubAppService.requestAsInstallation<GitHubPullRequest[]>(
      repo.installation.installationId,
      `/repos/${repo.fullName}/pulls?state=open&sort=updated&direction=desc&per_page=30`,
    );

    return (prs || []).map((pr) => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      htmlUrl: pr.html_url,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      author: pr.user?.login || 'unknown',
      headRef: pr.head.ref,
      headSha: pr.head.sha,
      baseRef: pr.base.ref,
    }));
  }

  /**
   * Retrieves pull request metadata and changed files, filtering out binary/deleted assets.
   */
  async getPullRequestDetails(repoId: string, userId: string, pullNumber: number) {
    const repo = await this.getVerifiedRepository(repoId, userId);

    const [pr, files] = await Promise.all([
      this.githubAppService.requestAsInstallation<GitHubPullRequest>(
        repo.installation.installationId,
        `/repos/${repo.fullName}/pulls/${pullNumber}`,
      ),
      this.githubAppService.requestAsInstallation<GitHubPullRequestFile[]>(
        repo.installation.installationId,
        `/repos/${repo.fullName}/pulls/${pullNumber}/files?per_page=100`,
      ),
    ]);

    // Filter eligible changed files
    const eligibleFiles = (files || []).filter(
      (f) => f.status !== 'removed' && !isBinaryFile(f.filename) && isEligibleCodeFile(f.filename),
    );

    return {
      repository: {
        id: repo.id,
        fullName: repo.fullName,
      },
      pullRequest: {
        number: pr.number,
        title: pr.title,
        state: pr.state,
        htmlUrl: pr.html_url,
        headRef: pr.head.ref,
        headSha: pr.head.sha,
        baseRef: pr.base.ref,
        baseSha: pr.base.sha,
        author: pr.user?.login || 'unknown',
      },
      files: eligibleFiles.map((f) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        changes: f.changes,
        patch: f.patch || null,
      })),
      totalFilesChanged: files.length,
      eligibleFilesCount: eligibleFiles.length,
    };
  }

  /**
   * Internal helper that resolves repository strictly by internal UUID and user ownership.
   * Throws 404 if not found or owned by another user to prevent existence leakage.
   */
  async getVerifiedRepository(repoId: string, userId: string) {
    const repo = await this.prisma.githubRepository.findFirst({
      where: {
        id: repoId,
        installation: {
          userId, // Strict multi-tenant isolation
        },
      },
      include: {
        installation: true,
      },
    });

    if (!repo) {
      throw new NotFoundException(`Repository with ID '${repoId}' not found.`);
    }

    return repo;
  }
}
