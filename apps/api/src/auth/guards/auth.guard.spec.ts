import { jest } from '@jest/globals';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { AuthService, SESSION_COOKIE_NAME } from '../auth.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let mockAuthService: {
    verifyJwt: jest.Mock;
  };
  let mockPrisma: {
    user: {
      findUnique: jest.Mock;
    };
  };

  const createMockExecutionContext = (reqPartial: Record<string, unknown>): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => reqPartial,
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    mockAuthService = {
      verifyJwt: jest.fn(),
    };
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
      },
    };

    guard = new AuthGuard(
      mockAuthService as unknown as AuthService,
      mockPrisma as unknown as PrismaService,
    );
  });

  it('should throw UnauthorizedException when no session cookie or Bearer header is present', async () => {
    const context = createMockExecutionContext({
      headers: {},
      cookies: {},
    });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Authentication required. Please sign in with GitHub to access this resource.',
    );
  });

  it('should extract token from HttpOnly cookie and attach authenticated user to request', async () => {
    const mockUser = {
      id: 'user-uuid-1',
      username: 'dev_user',
      email: 'dev@codesentinel.ai',
    };

    mockAuthService.verifyJwt.mockReturnValueOnce({ sub: 'user-uuid-1' });
    mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);

    const req: Record<string, unknown> = {
      headers: {},
      cookies: {
        [SESSION_COOKIE_NAME]: 'valid-session-jwt-token',
      },
    };
    const context = createMockExecutionContext(req);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockAuthService.verifyJwt).toHaveBeenCalledWith('valid-session-jwt-token');
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-uuid-1' } });
    expect(req.user).toEqual(mockUser);
  });

  it('should extract token from Authorization: Bearer header and authenticate request', async () => {
    const mockUser = {
      id: 'user-uuid-bearer',
      username: 'api_dev',
    };

    mockAuthService.verifyJwt.mockReturnValueOnce({ sub: 'user-uuid-bearer' });
    mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);

    const req: Record<string, unknown> = {
      headers: {
        authorization: 'Bearer bearer-token-sample',
      },
      cookies: {},
    };
    const context = createMockExecutionContext(req);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockAuthService.verifyJwt).toHaveBeenCalledWith('bearer-token-sample');
    expect(req.user).toEqual(mockUser);
  });

  it('should throw UnauthorizedException when session has expired', async () => {
    mockAuthService.verifyJwt.mockImplementationOnce(() => {
      throw new UnauthorizedException('Session has expired. Please sign in again.');
    });

    const context = createMockExecutionContext({
      headers: {},
      cookies: {
        [SESSION_COOKIE_NAME]: 'expired-jwt-token',
      },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if user in token no longer exists in database', async () => {
    mockAuthService.verifyJwt.mockReturnValueOnce({ sub: 'deleted-user-uuid' });
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    const context = createMockExecutionContext({
      headers: {},
      cookies: {
        [SESSION_COOKIE_NAME]: 'token-for-deleted-user',
      },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      'User account not found or has been deactivated. Please sign in again.',
    );
  });
});
