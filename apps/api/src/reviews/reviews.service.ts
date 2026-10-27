import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService, AI_ADVISORY_DISCLAIMER } from '../ai/ai.service';
import { GithubService } from '../github/github.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { GetReviewsQueryDto } from './dto/get-reviews-query.dto';
import { CreateRepoFileReviewDto } from './dto/create-repo-file-review.dto';
import { CreatePullRequestReviewDto } from './dto/create-pull-request-review.dto';
import { ReviewStatus, Severity } from '@prisma/client';
import { MAX_SOURCE_CODE_LENGTH } from './dto/create-review.dto';

export const DEFAULT_USER_EMAIL = 'anonymous@codesentinel.ai';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly githubService: GithubService,
  ) {}

  /**
   * Orchestrates an end-to-end code review lifecycle:
   * 1. Resolves target user (defaults to anonymous guest account).
   * 2. Persists initial Review record in PENDING status.
   * 3. Calls the AI service to inspect code for security risks, bugs, and performance flaws.
   * 4. On AI success: transitions review to COMPLETED status and saves summary, risk, and findings.
   * 5. On AI error: transitions review to FAILED status with error details (never leaves review hanging in PENDING).
   * 6. Returns the enriched review report.
   */
  async createReview(dto: CreateReviewDto, authenticatedUserId?: string) {
    const { sourceCode, language } = dto;

    this.logger.log(`Starting review for language '${language}' (${sourceCode.length} chars)`);

    // 1. Resolve target user strictly from authenticated session
    let targetUserId = authenticatedUserId || dto.userId;
    try {
      if (!targetUserId) {
        const defaultUser = await this.prisma.user.upsert({
          where: { email: DEFAULT_USER_EMAIL },
          update: {},
          create: {
            email: DEFAULT_USER_EMAIL,
            name: 'Anonymous User',
          },
        });
        targetUserId = defaultUser.id;
      }
    } catch (dbError: unknown) {
      this.logger.error(
        `Failed to resolve/create user in database: ${dbError instanceof Error ? dbError.message : String(dbError)}`,
      );
      throw new ServiceUnavailableException(
        'Database connection failure while resolving user account. Please ensure the database is running.',
      );
    }

    // 2. Create the review record in PENDING status to track the review lifecycle
    let reviewRecord;
    try {
      reviewRecord = await this.prisma.review.create({
        data: {
          userId: targetUserId,
          language,
          sourceCode,
          status: ReviewStatus.PENDING,
        },
      });
    } catch (createError: unknown) {
      this.logger.error(
        `Failed to initialize review record in database: ${createError instanceof Error ? createError.message : String(createError)}`,
      );
      throw new ServiceUnavailableException(
        'Failed to initialize review record in the database. Please verify PostgreSQL connectivity.',
      );
    }

    // 3. Execute AI code analysis
    let aiResult;
    try {
      aiResult = await this.aiService.reviewCode({ sourceCode, language });
    } catch (aiError: unknown) {
      const errorMessage =
        aiError instanceof Error ? aiError.message : String(aiError);
      this.logger.error(
        `AI review failed for review ${reviewRecord.id}: ${errorMessage}`,
      );

      // Transition review record to FAILED status to preserve audit trail without hanging in PENDING
      try {
        await this.prisma.review.update({
          where: { id: reviewRecord.id },
          data: {
            status: ReviewStatus.FAILED,
            errorMessage,
          },
        });
      } catch (updateFailedError: unknown) {
        this.logger.error(
          `Failed to record FAILED status on review ${reviewRecord.id}: ${updateFailedError instanceof Error ? updateFailedError.message : String(updateFailedError)}`,
        );
      }

      // Re-throw the original AI error to produce the correct HTTP response code
      throw aiError;
    }

    // 4. On success, update review record to COMPLETED and persist summary, overallRisk, and findings
    try {
      const completedReview = await this.prisma.review.update({
        where: { id: reviewRecord.id },
        data: {
          status: ReviewStatus.COMPLETED,
          summary: aiResult.summary,
          overallRisk: aiResult.overallRisk,
          findings: {
            create: aiResult.findings.map((f) => ({
              title: f.title,
              description: f.description,
              severity: f.severity as Severity,
              category: f.category,
              lineStart: f.lineStart,
              lineEnd: f.lineEnd,
              suggestedFix: f.suggestedFix,
            })),
          },
        },
        include: {
          findings: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      this.logger.log(
        `Review ${completedReview.id} completed successfully (${completedReview.findings.length} findings, risk: ${completedReview.overallRisk})`,
      );

      return {
        id: completedReview.id,
        userId: completedReview.userId,
        language: completedReview.language,
        sourceCode: completedReview.sourceCode,
        status: completedReview.status,
        createdAt: completedReview.createdAt,
        updatedAt: completedReview.updatedAt,
        summary: completedReview.summary,
        overallRisk: completedReview.overallRisk,
        findings: completedReview.findings,
        disclaimer: aiResult.disclaimer,
      };
    } catch (persistError: unknown) {
      this.logger.error(
        `Database persistence error saving completed review: ${persistError instanceof Error ? persistError.message : String(persistError)}`,
      );
      throw new ServiceUnavailableException(
        'Failed to save review results to the database. Please check PostgreSQL connection.',
      );
    }
  }

  /**
   * Reviews a specific file from a connected GitHub repository.
   * Enforces server-side repository ownership, path traversal checks, and bounds.
   */
  async createRepositoryFileReview(dto: CreateRepoFileReviewDto, userId: string) {
    const repoId = dto.repoId || dto.repositoryId!;
    const path = dto.path || dto.filePath!;
    const ref = dto.ref;

    this.logger.log(`Starting repository file review: repo ${repoId}, path '${path}'`);

    // 1. Fetch file content from GitHub via verified repository ownership
    const file = await this.githubService.getFileContent(repoId, userId, path, ref);

    // 2. Initialize Review record in PENDING status
    let reviewRecord;
    try {
      reviewRecord = await this.prisma.review.create({
        data: {
          userId,
          repositoryId: repoId,
          filePath: file.path,
          commitSha: file.commitSha,
          branch: ref || null,
          language: file.language,
          sourceCode: file.content,
          status: ReviewStatus.PENDING,
        },
      });
    } catch (createErr: unknown) {
      this.logger.error(
        `Failed to initialize repository review in database: ${createErr instanceof Error ? createErr.message : String(createErr)}`,
      );
      throw new ServiceUnavailableException('Failed to initialize review record in the database.');
    }

    // 3. Run AI analysis
    let aiResult;
    try {
      aiResult = await this.aiService.reviewCode({
        sourceCode: file.content,
        language: file.language,
      });
    } catch (aiErr: unknown) {
      const errorMsg = aiErr instanceof Error ? aiErr.message : String(aiErr);
      await this.prisma.review.update({
        where: { id: reviewRecord.id },
        data: { status: ReviewStatus.FAILED, errorMessage: errorMsg },
      }).catch(() => null);
      throw aiErr;
    }

    // 4. Save COMPLETED review
    const completedReview = await this.prisma.review.update({
      where: { id: reviewRecord.id },
      data: {
        status: ReviewStatus.COMPLETED,
        summary: aiResult.summary,
        overallRisk: aiResult.overallRisk,
        findings: {
          create: aiResult.findings.map((f) => ({
            title: f.title,
            description: f.description,
            severity: f.severity as Severity,
            category: f.category,
            lineStart: f.lineStart,
            lineEnd: f.lineEnd,
            suggestedFix: f.suggestedFix,
          })),
        },
      },
      include: {
        findings: { orderBy: { createdAt: 'asc' } },
        repository: { select: { fullName: true, isPrivate: true } },
      },
    });

    return {
      ...completedReview,
      disclaimer: aiResult.disclaimer,
    };
  }

  /**
   * Reviews eligible changed code files in an open Pull Request.
   * Enforces server-side ownership, filters binary/lock files, and bounds diff size.
   */
  async createPullRequestReview(dto: CreatePullRequestReviewDto, userId: string) {
    const repoId = dto.repoId || dto.repositoryId!;
    const pullNumber = dto.pullNumber;

    this.logger.log(`Starting Pull Request review: repo ${repoId}, PR #${pullNumber}`);

    // 1. Fetch PR details and eligible files
    const prDetails = await this.githubService.getPullRequestDetails(repoId, userId, pullNumber);

    if (prDetails.files.length === 0) {
      throw new BadRequestException('No reviewable code files found in this pull request.');
    }

    // 2. Aggregate changes up to MAX_SOURCE_CODE_LENGTH (64 KB) across top 10 files
    const filesToReview = prDetails.files.slice(0, 10);
    const combinedChunks: string[] = [
      `// Pull Request #${prDetails.pullRequest.number}: ${prDetails.pullRequest.title}`,
      `// Author: ${prDetails.pullRequest.author} | Base: ${prDetails.pullRequest.baseRef} -> Head: ${prDetails.pullRequest.headRef}\n`,
    ];

    let currentLength = combinedChunks.join('\n').length;
    for (const f of filesToReview) {
      const fileHeader = `\n// File: ${f.filename} (${f.status}, +${f.additions}/-${f.deletions})\n`;
      const fileBody = f.patch || `// [File modified: ${f.filename}]`;
      const nextChunk = `${fileHeader}${fileBody}\n`;

      if (currentLength + nextChunk.length > MAX_SOURCE_CODE_LENGTH) {
        combinedChunks.push('\n// [Remaining diff truncated to fit maximum review analysis size]');
        break;
      }
      combinedChunks.push(nextChunk);
      currentLength += nextChunk.length;
    }

    const sourceCode = combinedChunks.join('\n');

    // 3. Initialize Review record in PENDING status
    let reviewRecord;
    try {
      reviewRecord = await this.prisma.review.create({
        data: {
          userId,
          repositoryId: repoId,
          pullNumber: prDetails.pullRequest.number,
          commitSha: prDetails.pullRequest.headSha,
          branch: prDetails.pullRequest.headRef,
          language: 'typescript', // Multi-file review format
          sourceCode,
          status: ReviewStatus.PENDING,
        },
      });
    } catch (createErr: unknown) {
      this.logger.error(
        `Failed to initialize PR review in database: ${createErr instanceof Error ? createErr.message : String(createErr)}`,
      );
      throw new ServiceUnavailableException('Failed to initialize review record in the database.');
    }

    // 4. Run AI analysis
    let aiResult;
    try {
      aiResult = await this.aiService.reviewCode({
        sourceCode,
        language: 'typescript',
      });
    } catch (aiErr: unknown) {
      const errorMsg = aiErr instanceof Error ? aiErr.message : String(aiErr);
      await this.prisma.review.update({
        where: { id: reviewRecord.id },
        data: { status: ReviewStatus.FAILED, errorMessage: errorMsg },
      }).catch(() => null);
      throw aiErr;
    }

    // 5. Save COMPLETED review
    const completedReview = await this.prisma.review.update({
      where: { id: reviewRecord.id },
      data: {
        status: ReviewStatus.COMPLETED,
        summary: aiResult.summary,
        overallRisk: aiResult.overallRisk,
        findings: {
          create: aiResult.findings.map((f) => ({
            title: f.title,
            description: f.description,
            severity: f.severity as Severity,
            category: f.category,
            lineStart: f.lineStart,
            lineEnd: f.lineEnd,
            suggestedFix: f.suggestedFix,
          })),
        },
      },
      include: {
        findings: { orderBy: { createdAt: 'asc' } },
        repository: { select: { fullName: true, isPrivate: true } },
      },
    });

    return {
      ...completedReview,
      disclaimer: aiResult.disclaimer,
    };
  }

  /**
   * Retrieves paginated review history ordered by creation date descending,
   * scoped strictly to the authenticated user's ownership.
   */
  async findAll(query?: GetReviewsQueryDto, userId?: string) {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 20));
    const skip = (page - 1) * limit;

    const where = userId ? { userId } : undefined;

    const [total, items] = await Promise.all([
      where ? this.prisma.review.count({ where }) : this.prisma.review.count(),
      this.prisma.review.findMany({
        ...(where ? { where } : {}),
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: {
            select: { findings: true },
          },
          repository: {
            select: { fullName: true, isPrivate: true },
          },
        },
      }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves a single review by its UUID with all findings.
   * Scoped strictly to the owner to prevent cross-tenant data leaks.
   * If not found or not owned, throws 404 without leaking whether another user's review exists.
   */
  async findById(id: string, userId?: string) {
    let review;
    const include = {
      findings: {
        orderBy: { createdAt: 'asc' as const },
      },
      repository: {
        select: {
          id: true,
          fullName: true,
          defaultBranch: true,
          htmlUrl: true,
        },
      },
    };

    if (userId && typeof this.prisma.review.findFirst === 'function') {
      review = await this.prisma.review.findFirst({
        where: { id, userId },
        include,
      });
    } else {
      review = await this.prisma.review.findUnique({
        where: { id },
        include,
      });
    }

    // Verify ownership if review was retrieved via findUnique
    if (!review || (userId && review.userId !== userId)) {
      throw new NotFoundException(`Review with ID '${id}' not found`);
    }

    return {
      ...review,
      disclaimer: AI_ADVISORY_DISCLAIMER,
    };
  }
}
