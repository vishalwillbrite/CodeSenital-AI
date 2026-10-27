import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, SESSION_COOKIE_NAME } from '../auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth.types';

declare module 'express' {
  interface Request {
    user?: AuthenticatedUser;
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException(
        'Authentication required. Please sign in with GitHub to access this resource.',
      );
    }

    const payload = this.authService.verifyJwt(token);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException(
        'User account not found or has been deactivated. Please sign in again.',
      );
    }

    request.user = user;
    return true;
  }

  private extractToken(request: Request): string | null {
    // 1. Check HttpOnly cookie
    if (request.cookies && request.cookies[SESSION_COOKIE_NAME]) {
      return request.cookies[SESSION_COOKIE_NAME];
    }

    // Fallback: parse raw cookie header if cookies object is not populated
    if (request.headers.cookie) {
      const match = request.headers.cookie
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
      if (match) {
        return decodeURIComponent(match.split('=')[1]);
      }
    }

    // 2. Check Authorization Bearer header
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }

    return null;
  }
}
