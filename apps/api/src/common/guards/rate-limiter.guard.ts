import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface RateLimitRecord {
  timestamps: number[];
}

@Injectable()
export class RateLimiterGuard implements CanActivate {
  private readonly logger = new Logger(RateLimiterGuard.name);
  private readonly clients = new Map<string, RateLimitRecord>();

  // Default: 20 requests per 60 seconds
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor() {
    const envWindow = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '', 10);
    this.windowMs = !isNaN(envWindow) && envWindow > 0 ? envWindow : 60000;

    const envMax = parseInt(process.env.RATE_LIMIT_MAX || '', 10);
    this.maxRequests = !isNaN(envMax) && envMax > 0 ? envMax : 20;

    // Periodically cleanup expired entries every 2 minutes
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.clients.entries()) {
        record.timestamps = record.timestamps.filter(
          (t) => now - t < this.windowMs,
        );
        if (record.timestamps.length === 0) {
          this.clients.delete(key);
        }
      }
    }, 120000);

    if (cleanupInterval.unref) {
      cleanupInterval.unref();
    }
  }

  canActivate(context: ExecutionContext): boolean {
    // If rate limiting is explicitly disabled (e.g. during specific automated test suites)
    if (process.env.DISABLE_RATE_LIMIT === 'true') {
      return true;
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const clientIp = this.getClientIdentifier(req);
    const now = Date.now();

    let record = this.clients.get(clientIp);
    if (!record) {
      record = { timestamps: [] };
      this.clients.set(clientIp, record);
    }

    // Keep only timestamps within window
    record.timestamps = record.timestamps.filter((t) => now - t < this.windowMs);

    const remaining = Math.max(0, this.maxRequests - record.timestamps.length);
    const oldest = record.timestamps[0] || now;
    const resetTimeSec = Math.ceil((oldest + this.windowMs - now) / 1000);

    if (res && typeof res.setHeader === 'function') {
      res.setHeader('X-RateLimit-Limit', this.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining - 1).toString());
      res.setHeader('X-RateLimit-Reset', resetTimeSec.toString());
    }

    if (record.timestamps.length >= this.maxRequests) {
      this.logger.warn(
        `Rate limit exceeded for client ${clientIp}. Max ${this.maxRequests} per ${this.windowMs / 1000}s.`,
      );
      if (res && typeof res.setHeader === 'function') {
        res.setHeader('Retry-After', resetTimeSec.toString());
      }
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Too many code review requests. Please slow down and try again in ${resetTimeSec} seconds.`,
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    record.timestamps.push(now);
    return true;
  }

  private getClientIdentifier(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return forwarded[0].trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown-client';
  }

  // Exposed for tests
  reset(): void {
    this.clients.clear();
  }
}
