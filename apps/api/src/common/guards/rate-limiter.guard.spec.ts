import { jest } from '@jest/globals';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { RateLimiterGuard } from './rate-limiter.guard';

describe('RateLimiterGuard', () => {
  let guard: RateLimiterGuard;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
    process.env.RATE_LIMIT_MAX = '3';
    guard = new RateLimiterGuard();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function createMockContext(ip = '127.0.0.1'): {
    context: ExecutionContext;
    headers: Record<string, string>;
  } {
    const headers: Record<string, string> = {};
    const req = {
      ip,
      headers: {},
      socket: { remoteAddress: ip },
    };
    const res = {
      setHeader: jest.fn((key: string, val: string) => {
        headers[key] = val;
      }),
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as unknown as ExecutionContext;

    return { context, headers };
  }

  it('should allow requests under the limit and set rate limit headers', () => {
    const { context, headers } = createMockContext();

    expect(guard.canActivate(context)).toBe(true);
    expect(headers['X-RateLimit-Limit']).toBe('3');
    expect(headers['X-RateLimit-Remaining']).toBe('2');

    expect(guard.canActivate(context)).toBe(true);
    expect(headers['X-RateLimit-Remaining']).toBe('1');

    expect(guard.canActivate(context)).toBe(true);
    expect(headers['X-RateLimit-Remaining']).toBe('0');
  });

  it('should throw 429 HttpException when limit is exceeded', () => {
    const { context, headers } = createMockContext();

    // 3 allowed
    guard.canActivate(context);
    guard.canActivate(context);
    guard.canActivate(context);

    // 4th request must throw 429
    expect(() => guard.canActivate(context)).toThrow(HttpException);
    try {
      guard.canActivate(context);
    } catch (err: unknown) {
      const httpErr = err as HttpException;
      expect(httpErr.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(headers['Retry-After']).toBeDefined();
    }
  });

  it('should track rate limits independently per client IP', () => {
    const clientA = createMockContext('10.0.0.1');
    const clientB = createMockContext('10.0.0.2');

    // Client A uses all 3
    guard.canActivate(clientA.context);
    guard.canActivate(clientA.context);
    guard.canActivate(clientA.context);

    // Client A is blocked
    expect(() => guard.canActivate(clientA.context)).toThrow(HttpException);

    // Client B is still allowed
    expect(guard.canActivate(clientB.context)).toBe(true);
  });
});
