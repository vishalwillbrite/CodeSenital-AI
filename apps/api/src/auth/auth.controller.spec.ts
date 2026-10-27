import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import {
  AuthService,
  SESSION_COOKIE_NAME,
  OAUTH_STATE_COOKIE_NAME,
} from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { RateLimiterGuard } from '../common/guards/rate-limiter.guard';
import type { AuthenticatedUser } from './auth.types';

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: {
    isOAuthConfigured: jest.Mock;
    getAuthorizationUrl: jest.Mock;
    getFrontendUrl: jest.Mock;
    validateReturnUrl: jest.Mock;
    exchangeCodeForToken: jest.Mock;
    fetchGitHubProfile: jest.Mock;
    findOrCreateUser: jest.Mock;
    generateJwt: jest.Mock;
  };

  const createMockResponse = () => {
    const res: Partial<Response> = {
      cookie: jest.fn().mockReturnThis() as unknown as Response['cookie'],
      clearCookie: jest.fn().mockReturnThis() as unknown as Response['clearCookie'],
      redirect: jest.fn().mockReturnThis() as unknown as Response['redirect'],
      status: jest.fn().mockReturnThis() as unknown as Response['status'],
      json: jest.fn().mockReturnThis() as unknown as Response['json'],
    };
    return res as unknown as Response;
  };

  beforeEach(async () => {
    mockAuthService = {
      isOAuthConfigured: jest.fn().mockReturnValue(true),
      getAuthorizationUrl: jest
        .fn()
        .mockReturnValue('https://github.com/login/oauth/authorize?test=1'),
      getFrontendUrl: jest.fn().mockReturnValue('http://localhost:3000'),
      validateReturnUrl: jest.fn().mockImplementation((url) => (url ? String(url) : '/')),
      exchangeCodeForToken: jest.fn().mockResolvedValue('gh_token_12345'),
      fetchGitHubProfile: jest.fn().mockResolvedValue({
        id: 12345,
        login: 'octocat',
        name: 'The Octocat',
        email: 'octocat@github.com',
        avatar_url: 'https://avatar.jpg',
        primaryEmail: 'octocat@github.com',
      }),
      findOrCreateUser: jest.fn().mockResolvedValue({
        id: 'user-uuid-1',
        githubId: '12345',
        username: 'octocat',
        name: 'The Octocat',
        email: 'octocat@github.com',
        avatarUrl: 'https://avatar.jpg',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      generateJwt: jest.fn().mockReturnValue('jwt-session-token-xyz'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RateLimiterGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('getStatus', () => {
    it('should return configured status', () => {
      expect(controller.getStatus()).toEqual({ configured: true });
    });
  });

  describe('signInWithGitHub', () => {
    it('should set CSRF state cookie and redirect to GitHub authorization URL', async () => {
      const res = createMockResponse();

      await controller.signInWithGitHub('/workspace', res);

      expect(res.cookie).toHaveBeenCalledWith(
        OAUTH_STATE_COOKIE_NAME,
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        }),
      );
      expect(res.redirect).toHaveBeenCalledWith(
        'https://github.com/login/oauth/authorize?test=1',
      );
    });

    it('should redirect to frontend with auth_error if OAuth is not configured', async () => {
      mockAuthService.isOAuthConfigured.mockReturnValue(false);
      const res = createMockResponse();

      await controller.signInWithGitHub('/workspace', res);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringMatching(/auth_error=GitHub(\+|%20)OAuth(\+|%20)is(\+|%20)not(\+|%20)configured/),
      );
    });
  });

  describe('gitHubCallback', () => {
    it('should handle cancelled authorization error from GitHub gracefully', async () => {
      const res = createMockResponse();
      const req = { cookies: {} } as Request;

      await controller.gitHubCallback(
        undefined,
        undefined,
        'access_denied',
        'The user has denied your application access.',
        req,
        res,
      );

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('auth_error='),
      );
    });

    it('should detect CSRF state mismatch and redirect to frontend with error', async () => {
      const res = createMockResponse();
      const req = {
        cookies: {
          [OAUTH_STATE_COOKIE_NAME]: 'expected-legitimate-state',
        },
      } as unknown as Request;

      await controller.gitHubCallback(
        'some-code',
        'attacker-forged-state',
        undefined,
        undefined,
        req,
        res,
      );

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('Invalid%20OAuth%20state'),
      );
    });

    it('should successfully complete OAuth flow, set session cookie, and redirect to destination', async () => {
      const validState = 'matching-valid-csrf-state';
      const res = createMockResponse();
      const req = {
        cookies: {
          [OAUTH_STATE_COOKIE_NAME]: validState,
        },
      } as unknown as Request;

      await controller.gitHubCallback(
        'valid-github-code',
        validState,
        undefined,
        undefined,
        req,
        res,
      );

      expect(mockAuthService.exchangeCodeForToken).toHaveBeenCalledWith('valid-github-code');
      expect(mockAuthService.fetchGitHubProfile).toHaveBeenCalledWith('gh_token_12345');
      expect(mockAuthService.findOrCreateUser).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalledWith(
        SESSION_COOKIE_NAME,
        'jwt-session-token-xyz',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        }),
      );
      expect(res.redirect).toHaveBeenCalledWith('http://localhost:3000/');
    });
  });

  describe('getCurrentUser', () => {
    it('should return sanitized profile for authenticated user', () => {
      const mockUser: AuthenticatedUser = {
        id: 'user-uuid-1',
        githubId: '12345',
        username: 'octocat',
        name: 'The Octocat',
        email: 'octocat@github.com',
        avatarUrl: 'https://avatar.jpg',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = controller.getCurrentUser(mockUser);
      expect(result).toEqual({
        user: {
          id: 'user-uuid-1',
          githubId: '12345',
          username: 'octocat',
          name: 'The Octocat',
          email: 'octocat@github.com',
          avatarUrl: 'https://avatar.jpg',
          createdAt: mockUser.createdAt,
        },
      });
    });
  });

  describe('logout', () => {
    it('should clear session cookie and return confirmation message', () => {
      const res = createMockResponse();
      const result = controller.logout(res);

      expect(res.clearCookie).toHaveBeenCalledWith(
        SESSION_COOKIE_NAME,
        expect.objectContaining({
          httpOnly: true,
          path: '/',
        }),
      );
      expect(result).toEqual({
        message: 'Successfully signed out.',
      });
    });
  });
});
