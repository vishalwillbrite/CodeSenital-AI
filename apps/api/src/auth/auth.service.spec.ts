import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ServiceUnavailableException,
  UnauthorizedException,
  BadGatewayException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let mockPrisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    process.env.GITHUB_CLIENT_ID = 'test-client-id';
    process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
    process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long';

    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isOAuthConfigured', () => {
    it('should return true when GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are set', () => {
      expect(service.isOAuthConfigured()).toBe(true);
    });

    it('should return false when GITHUB_CLIENT_ID is missing', () => {
      delete process.env.GITHUB_CLIENT_ID;
      expect(service.isOAuthConfigured()).toBe(false);
    });

    it('should return false when GITHUB_CLIENT_SECRET is missing', () => {
      delete process.env.GITHUB_CLIENT_SECRET;
      expect(service.isOAuthConfigured()).toBe(false);
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should construct a valid GitHub OAuth URL with CSRF state and scopes', () => {
      const state = 'test-random-state-12345';
      const url = service.getAuthorizationUrl(state);

      expect(url).toContain('https://github.com/login/oauth/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain(`state=${state}`);
      expect(url).toContain('scope=read%3Auser%20user%3Aemail');
    });

    it('should throw ServiceUnavailableException when GITHUB_CLIENT_ID is missing', () => {
      delete process.env.GITHUB_CLIENT_ID;
      expect(() => service.getAuthorizationUrl('state')).toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('JWT Session Tokens', () => {
    it('should sign and verify valid JWT session token', () => {
      const user = {
        id: 'user-uuid-123',
        username: 'dev_user',
        email: 'dev@codesentinel.ai',
      };

      const token = service.generateJwt(user);
      expect(typeof token).toBe('string');

      const payload = service.verifyJwt(token);
      expect(payload.sub).toBe('user-uuid-123');
      expect(payload.username).toBe('dev_user');
      expect(payload.email).toBe('dev@codesentinel.ai');
    });

    it('should throw UnauthorizedException on invalid or forged token', () => {
      expect(() => service.verifyJwt('forged.invalid.token')).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('validateReturnUrl (Open Redirect Prevention)', () => {
    it('should permit valid relative paths', () => {
      expect(service.validateReturnUrl('/workspace')).toBe('/workspace');
      expect(service.validateReturnUrl('/history?page=2')).toBe('/history?page=2');
      expect(service.validateReturnUrl('/')).toBe('/');
    });

    it('should reject open redirect attempts to external protocols or domains', () => {
      // Protocol-relative URLs
      expect(service.validateReturnUrl('//evil.com')).toBe('/');
      expect(service.validateReturnUrl('//malicious-site.org/phish')).toBe('/');
      // Backslash evasion
      expect(service.validateReturnUrl('/\\evil.com')).toBe('/');
      // Full external URLs
      expect(service.validateReturnUrl('https://evil.com')).toBe('/');
      expect(service.validateReturnUrl('http://attacker.com')).toBe('/');
      // Javascript URI
      expect(service.validateReturnUrl('javascript:alert(1)')).toBe('/');
      // Null, empty, or undefined
      expect(service.validateReturnUrl(null)).toBe('/');
      expect(service.validateReturnUrl(undefined)).toBe('/');
      expect(service.validateReturnUrl('')).toBe('/');
    });
  });

  describe('findOrCreateUser', () => {
    it('should update existing user when found by githubId', async () => {
      const existingUser = {
        id: 'user-uuid-1',
        githubId: '998877',
        username: 'old_login',
        name: 'Old Name',
        email: 'test@example.com',
        avatarUrl: 'old_avatar',
      };

      mockPrisma.user.findUnique.mockResolvedValueOnce(existingUser);
      mockPrisma.user.update.mockResolvedValueOnce({
        ...existingUser,
        username: 'new_login',
      });

      const profile = {
        id: 998877,
        login: 'new_login',
        name: 'New Name',
        email: 'test@example.com',
        avatar_url: 'https://new_avatar.jpg',
        primaryEmail: 'test@example.com',
      };

      const result = await service.findOrCreateUser(profile);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-uuid-1' },
          data: expect.objectContaining({ username: 'new_login' }),
        }),
      );
      expect(result.username).toBe('new_login');
    });

    it('should link GitHub account to existing user by verified primary email', async () => {
      // Not found by githubId
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      // Found by email
      const existingEmailUser = {
        id: 'user-uuid-email',
        email: 'engineer@corp.com',
        name: 'Engineer',
        githubId: null,
      };
      mockPrisma.user.findUnique.mockResolvedValueOnce(existingEmailUser);
      mockPrisma.user.update.mockResolvedValueOnce({
        ...existingEmailUser,
        githubId: '554433',
        username: 'github_eng',
      });

      const profile = {
        id: 554433,
        login: 'github_eng',
        name: 'Engineer',
        email: 'engineer@corp.com',
        avatar_url: 'https://avatar.jpg',
        primaryEmail: 'engineer@corp.com',
      };

      const result = await service.findOrCreateUser(profile);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-email' },
        data: expect.objectContaining({ githubId: '554433', username: 'github_eng' }),
      });
      expect(result.githubId).toBe('554433');
    });

    it('should create new user record if not found by githubId or email', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null); // by githubId
      mockPrisma.user.findUnique.mockResolvedValueOnce(null); // by email

      mockPrisma.user.create.mockResolvedValueOnce({
        id: 'new-user-uuid',
        githubId: '112233',
        username: 'newbie',
        name: 'New Developer',
        email: 'newbie@example.com',
        avatarUrl: 'https://avatar.png',
      });

      const profile = {
        id: 112233,
        login: 'newbie',
        name: 'New Developer',
        email: 'newbie@example.com',
        avatar_url: 'https://avatar.png',
        primaryEmail: 'newbie@example.com',
      };

      const result = await service.findOrCreateUser(profile);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          githubId: '112233',
          username: 'newbie',
          name: 'New Developer',
          email: 'newbie@example.com',
          avatarUrl: 'https://avatar.png',
        },
      });
      expect(result.id).toBe('new-user-uuid');
    });
  });
});
