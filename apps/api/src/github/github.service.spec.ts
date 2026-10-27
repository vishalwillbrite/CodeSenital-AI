import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import jwt from 'jsonwebtoken';
import { GithubService } from './github.service';
import { GithubAppService } from './github-app.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';

describe('GithubService', () => {
  let service: GithubService;
  let mockPrisma: {
    githubInstallation: {
      upsert: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      delete: jest.Mock;
    };
    githubRepository: {
      upsert: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
  };
  let mockAppService: {
    isConfigured: jest.Mock;
    getAppSlug: jest.Mock;
    requestAsApp: jest.Mock;
    requestAsInstallation: jest.Mock;
    evictToken: jest.Mock;
  };

  const JWT_SECRET = 'test_jwt_secret_for_unit_tests_32chars';

  beforeEach(async () => {
    process.env.JWT_SECRET = JWT_SECRET;

    mockPrisma = {
      githubInstallation: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
      githubRepository: {
        upsert: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    mockAppService = {
      isConfigured: jest.fn().mockReturnValue(true),
      getAppSlug: jest.fn().mockReturnValue('codesentinel-ai'),
      requestAsApp: jest.fn(),
      requestAsInstallation: jest.fn(),
      evictToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GithubService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: GithubAppService, useValue: mockAppService },
      ],
    }).compile();

    service = module.get<GithubService>(GithubService);
  });

  describe('getConnectUrl', () => {
    it('should generate signed state token and construct GitHub App installation URL', () => {
      const result = service.getConnectUrl('user-uuid-1');
      expect(result.url).toContain('https://github.com/apps/codesentinel-ai/installations/new?state=');

      const state = new URL(result.url).searchParams.get('state');
      expect(state).toBeDefined();

      const decoded = jwt.verify(state!, JWT_SECRET) as { sub: string; purpose: string };
      expect(decoded.sub).toBe('user-uuid-1');
      expect(decoded.purpose).toBe('github_app_connect');
    });
  });

  describe('handleInstallCallback', () => {
    it('should throw UnauthorizedException on invalid state token', async () => {
      await expect(
        service.handleInstallCallback('12345', 'forged-state-token', 'user-uuid-1'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if state token belongs to a different user (CSRF / session switch)', async () => {
      const stateForOtherUser = jwt.sign(
        { sub: 'victim-user-id', purpose: 'github_app_connect' },
        JWT_SECRET,
        { expiresIn: '10m' },
      );

      await expect(
        service.handleInstallCallback('12345', stateForOtherUser, 'attacker-user-id'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should verify installation with GitHub, upsert installation and repositories for valid user', async () => {
      const validState = jwt.sign(
        { sub: 'user-uuid-1', purpose: 'github_app_connect' },
        JWT_SECRET,
        { expiresIn: '10m' },
      );

      mockAppService.requestAsApp.mockResolvedValueOnce({
        id: 98765,
        account: { id: 111, login: 'testorg', type: 'Organization' },
        target_id: 111,
      });

      mockPrisma.githubInstallation.upsert.mockResolvedValueOnce({
        id: 'inst-db-uuid-1',
        installationId: '98765',
        userId: 'user-uuid-1',
      });

      mockAppService.requestAsInstallation.mockResolvedValueOnce({
        repositories: [
          {
            id: 555,
            name: 'repo-one',
            full_name: 'testorg/repo-one',
            private: true,
            default_branch: 'main',
            owner: { login: 'testorg', id: 111 },
          },
        ],
      });

      const res = await service.handleInstallCallback('98765', validState, 'user-uuid-1');
      expect(res.success).toBe(true);
      expect(mockPrisma.githubInstallation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { installationId: '98765' },
        }),
      );
      expect(mockPrisma.githubRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { fullName: 'testorg/repo-one' },
        }),
      );
    });
  });

  describe('Multi-tenant repository isolation and access control', () => {
    it('should throw NotFoundException when user attempts to access repository owned by another user', async () => {
      mockPrisma.githubRepository.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.getRepositoryTree('repo-belonging-to-other-user', 'attacker-user-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when file is requested for unowned repository', async () => {
      mockPrisma.githubRepository.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.getFileContent('foreign-repo-id', 'attacker-id', 'src/index.ts'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('File exploration and security bounds', () => {
    it('should reject path traversal in getFileContent', async () => {
      mockPrisma.githubRepository.findFirst.mockResolvedValueOnce({
        id: 'repo-1',
        fullName: 'owner/repo',
        defaultBranch: 'main',
        installation: { installationId: '12345' },
      });

      await expect(
        service.getFileContent('repo-1', 'user-1', '../../etc/passwd'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject binary files in getFileContent', async () => {
      mockPrisma.githubRepository.findFirst.mockResolvedValueOnce({
        id: 'repo-1',
        fullName: 'owner/repo',
        defaultBranch: 'main',
        installation: { installationId: '12345' },
      });

      await expect(
        service.getFileContent('repo-1', 'user-1', 'assets/image.png'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should retrieve and decode base64 file content correctly', async () => {
      mockPrisma.githubRepository.findFirst.mockResolvedValueOnce({
        id: 'repo-1',
        fullName: 'owner/repo',
        defaultBranch: 'main',
        installation: { installationId: '12345' },
      });

      const rawSource = 'function add(a: number, b: number) { return a + b; }';
      const base64Source = Buffer.from(rawSource).toString('base64');

      mockAppService.requestAsInstallation.mockResolvedValueOnce({
        type: 'file',
        size: rawSource.length,
        sha: 'blob-sha-123',
        content: base64Source,
        encoding: 'base64',
      });

      const file = await service.getFileContent('repo-1', 'user-1', 'src/math.ts');
      expect(file.content).toBe(rawSource);
      expect(file.language).toBe('typescript');
      expect(file.path).toBe('src/math.ts');
    });
  });
});
