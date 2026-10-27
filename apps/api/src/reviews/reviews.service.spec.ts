import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsService, DEFAULT_USER_EMAIL } from './reviews.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { GithubService } from '../github/github.service';
import { ServiceUnavailableException, NotFoundException, BadGatewayException } from '@nestjs/common';
import { ReviewStatus, Severity } from '@prisma/client';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let mockPrisma: {
    user: {
      upsert: jest.Mock;
    };
    review: {
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
    };
  };
  let mockAiService: {
    reviewCode: jest.Mock;
  };
  let mockGithubService: {
    getFileContent: jest.Mock;
    getPullRequestDetails: jest.Mock;
  };

  const mockAiOutput = {
    summary: 'Detected a dangerous command injection vulnerability.',
    overallRisk: 'high' as const,
    findings: [
      {
        title: 'Command Injection',
        description: 'Direct shell execution of untrusted input.',
        severity: 'CRITICAL' as const,
        category: 'security',
        lineStart: 3,
        lineEnd: 3,
        suggestedFix: 'execFile("ls", [args])',
      },
    ],
    disclaimer: 'Advisory disclaimer',
  };

  beforeEach(async () => {
    mockPrisma = {
      user: {
        upsert: jest.fn().mockResolvedValue({
          id: 'user-uuid-1',
          email: DEFAULT_USER_EMAIL,
          name: 'Anonymous User',
        }),
      },
      review: {
        create: jest.fn().mockResolvedValue({
          id: 'review-uuid-1',
          userId: 'user-uuid-1',
          language: 'javascript',
          sourceCode: 'child_process.exec(cmd);',
          status: ReviewStatus.PENDING,
          createdAt: new Date('2026-10-21T10:00:00Z'),
          updatedAt: new Date('2026-10-21T10:00:00Z'),
        }),
        update: jest.fn().mockImplementation(({ where, data }) =>
          Promise.resolve({
            id: where.id,
            userId: 'user-uuid-1',
            language: 'javascript',
            sourceCode: 'child_process.exec(cmd);',
            status: data.status,
            summary: data.summary || null,
            overallRisk: data.overallRisk || null,
            errorMessage: data.errorMessage || null,
            createdAt: new Date('2026-10-21T10:00:00Z'),
            updatedAt: new Date('2026-10-21T10:00:05Z'),
            findings: data.findings?.create
              ? data.findings.create.map(
                  (
                    f: {
                      title: string;
                      description: string;
                      severity: Severity;
                      category: string;
                      lineStart: number | null;
                      lineEnd: number | null;
                      suggestedFix: string | null;
                    },
                    idx: number,
                  ) => ({
                    id: `finding-uuid-${idx + 1}`,
                    reviewId: where.id,
                    title: f.title,
                    description: f.description,
                    severity: f.severity,
                    category: f.category,
                    lineStart: f.lineStart,
                    lineEnd: f.lineEnd,
                    suggestedFix: f.suggestedFix,
                    createdAt: new Date('2026-10-21T10:00:05Z'),
                    updatedAt: new Date('2026-10-21T10:00:05Z'),
                  }),
                )
              : [],
          }),
        ),
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'review-uuid-1',
            language: 'javascript',
            status: ReviewStatus.COMPLETED,
            summary: 'Detected issue',
            overallRisk: 'high',
            createdAt: new Date('2026-10-21T10:00:00Z'),
            _count: { findings: 1 },
          },
        ]),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    mockAiService = {
      reviewCode: jest.fn().mockResolvedValue(mockAiOutput),
    };

    mockGithubService = {
      getFileContent: jest.fn().mockResolvedValue({
        path: 'src/main.ts',
        language: 'typescript',
        size: 100,
        content: 'const a = 1;',
        commitSha: 'commit-sha-123',
        isTruncated: false,
      }),
      getPullRequestDetails: jest.fn().mockResolvedValue({
        repository: { id: 'repo-1', fullName: 'owner/repo' },
        pullRequest: {
          number: 42,
          title: 'Feature PR',
          state: 'open',
          headRef: 'feat',
          headSha: 'head-sha-456',
          baseRef: 'main',
          baseSha: 'base-sha-123',
          author: 'dev',
        },
        files: [
          {
            filename: 'src/utils.ts',
            status: 'modified',
            additions: 10,
            deletions: 2,
            changes: 12,
            patch: '@@ -1,2 +1,3 @@',
          },
        ],
        totalFilesChanged: 1,
        eligibleFilesCount: 1,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiService, useValue: mockAiService },
        { provide: GithubService, useValue: mockGithubService },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createReview lifecycle', () => {
    it('should complete full lifecycle: PENDING -> COMPLETED with persisted summary, risk, and findings', async () => {
      const result = await service.createReview({
        sourceCode: 'child_process.exec(cmd);',
        language: 'javascript',
      });

      // 1. Initial creation with PENDING
      expect(mockPrisma.review.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-uuid-1',
          language: 'javascript',
          sourceCode: 'child_process.exec(cmd);',
          status: ReviewStatus.PENDING,
        },
      });

      // 2. AI called
      expect(mockAiService.reviewCode).toHaveBeenCalledWith({
        sourceCode: 'child_process.exec(cmd);',
        language: 'javascript',
      });

      // 3. Final update with COMPLETED, summary, overallRisk, and findings
      expect(mockPrisma.review.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'review-uuid-1' },
          data: expect.objectContaining({
            status: ReviewStatus.COMPLETED,
            summary: 'Detected a dangerous command injection vulnerability.',
            overallRisk: 'high',
          }),
        }),
      );

      // 4. Returned payload
      expect(result.id).toBe('review-uuid-1');
      expect(result.status).toBe(ReviewStatus.COMPLETED);
      expect(result.summary).toBe('Detected a dangerous command injection vulnerability.');
      expect(result.overallRisk).toBe('high');
      expect(result.findings).toHaveLength(1);
    });

    it('should transition review to FAILED and persist errorMessage if AI provider fails', async () => {
      mockAiService.reviewCode.mockRejectedValueOnce(
        new BadGatewayException('Gemini service unavailable (503)'),
      );

      await expect(
        service.createReview({
          sourceCode: 'const x = 1;',
          language: 'typescript',
        }),
      ).rejects.toThrow(BadGatewayException);

      // Verify review was updated to FAILED with error message
      expect(mockPrisma.review.update).toHaveBeenCalledWith({
        where: { id: 'review-uuid-1' },
        data: {
          status: ReviewStatus.FAILED,
          errorMessage: 'Gemini service unavailable (503)',
        },
      });
    });

    it('should use provided userId if specified', async () => {
      await service.createReview({
        sourceCode: 'const x = 1;',
        language: 'typescript',
        userId: 'custom-user-123',
      });

      expect(mockPrisma.user.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.review.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'custom-user-123',
          }),
        }),
      );
    });

    it('should throw ServiceUnavailableException if database user upsert fails', async () => {
      mockPrisma.user.upsert.mockRejectedValueOnce(new Error('Database offline'));

      await expect(
        service.createReview({
          sourceCode: 'const x = 1;',
          language: 'typescript',
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('should throw ServiceUnavailableException if review record creation fails', async () => {
      mockPrisma.review.create.mockRejectedValueOnce(new Error('DB creation error'));

      await expect(
        service.createReview({
          sourceCode: 'const x = 1;',
          language: 'typescript',
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('findAll (pagination & ownership)', () => {
    it('should return paginated items with meta information', async () => {
      mockPrisma.review.count.mockResolvedValueOnce(45);

      const result = await service.findAll({ page: 2, limit: 10 });

      expect(mockPrisma.review.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        skip: 10,
        take: 10,
        include: {
          _count: {
            select: { findings: true },
          },
          repository: {
            select: { fullName: true, isPrivate: true },
          },
        },
      });

      expect(result.meta).toEqual({
        total: 45,
        page: 2,
        limit: 10,
        totalPages: 5,
      });
    });

    it('should filter reviews strictly by authenticated userId when provided', async () => {
      mockPrisma.review.count.mockResolvedValueOnce(2);
      mockPrisma.review.findMany.mockResolvedValueOnce([
        { id: 'rev-user-1', userId: 'target-user-123', _count: { findings: 0 } },
      ]);

      const result = await service.findAll({ page: 1, limit: 10 }, 'target-user-123');

      expect(mockPrisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'target-user-123' },
        }),
      );
      expect(result.items).toHaveLength(1);
    });

    it('should use default page=1 and limit=20 if not provided', async () => {
      mockPrisma.review.count.mockResolvedValueOnce(5);

      const result = await service.findAll();

      expect(mockPrisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        }),
      );
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });
  });

  describe('findById (ownership scoping)', () => {
    it('should return review with findings and disclaimer when found for owner', async () => {
      const mockRecord = {
        id: 'review-1',
        userId: 'owner-user-id',
        language: 'typescript',
        status: ReviewStatus.COMPLETED,
        findings: [{ id: 'f1', title: 'Issue 1' }],
      };
      mockPrisma.review.findFirst.mockResolvedValueOnce(mockRecord);

      const result = await service.findById('review-1', 'owner-user-id');
      expect(result.id).toBe('review-1');
      expect(result.findings).toHaveLength(1);
      expect(result.disclaimer).toBeDefined();
    });

    it('should throw NotFoundException when review belongs to another user (preventing leakage)', async () => {
      mockPrisma.review.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.findById('review-belonging-to-other-user', 'attacker-user-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when review does not exist', async () => {
      mockPrisma.review.findUnique.mockResolvedValueOnce(null);

      await expect(service.findById('non-existent-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createRepositoryFileReview', () => {
    it('should fetch file from githubService, run AI review, and persist repository review', async () => {
      const dto = {
        repoId: 'repo-uuid-1',
        path: 'src/main.ts',
        ref: 'main',
      };

      const result = await service.createRepositoryFileReview(dto, 'user-uuid-1');

      expect(mockGithubService.getFileContent).toHaveBeenCalledWith(
        'repo-uuid-1',
        'user-uuid-1',
        'src/main.ts',
        'main',
      );
      expect(mockAiService.reviewCode).toHaveBeenCalled();
      expect(result.status).toBe(ReviewStatus.COMPLETED);
    });
  });

  describe('createPullRequestReview', () => {
    it('should fetch PR changed files, build diff payload, run AI review, and persist PR review', async () => {
      const dto = {
        repoId: 'repo-uuid-1',
        pullNumber: 42,
      };

      const result = await service.createPullRequestReview(dto, 'user-uuid-1');

      expect(mockGithubService.getPullRequestDetails).toHaveBeenCalledWith(
        'repo-uuid-1',
        'user-uuid-1',
        42,
      );
      expect(mockAiService.reviewCode).toHaveBeenCalled();
      expect(result.status).toBe(ReviewStatus.COMPLETED);
    });
  });
});
