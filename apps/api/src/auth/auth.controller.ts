import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import {
  AuthService,
  SESSION_COOKIE_NAME,
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_RETURN_TO_COOKIE_NAME,
} from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedUser } from './auth.types';
import { RateLimiterGuard } from '../common/guards/rate-limiter.guard';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * GET /auth/status
   * Public endpoint indicating if GitHub OAuth has been configured in the environment.
   */
  @Get('status')
  getStatus() {
    return {
      configured: this.authService.isOAuthConfigured(),
    };
  }

  /**
   * GET /auth/github
   * Initiates GitHub OAuth authentication flow.
   * Generates a secure, cryptographically random state parameter stored in an HttpOnly cookie
   * to defend against Cross-Site Request Forgery (CSRF).
   */
  @Get('github')
  @UseGuards(RateLimiterGuard)
  async signInWithGitHub(
    @Query('returnTo') returnTo: string | undefined,
    @Res() res: Response,
  ) {
    if (!this.authService.isOAuthConfigured()) {
      const frontendUrl = this.authService.getFrontendUrl();
      const safeReturnTo = this.authService.validateReturnUrl(returnTo);
      const redirectTarget = safeReturnTo.startsWith('http')
        ? safeReturnTo
        : `${frontendUrl}${safeReturnTo}`;
      const url = new URL(redirectTarget);
      url.searchParams.set(
        'auth_error',
        'GitHub OAuth is not configured on the server. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env to enable sign-in.',
      );
      return res.redirect(url.toString());
    }

    const isProduction = process.env.NODE_ENV === 'production';

    // 1. Generate cryptographically strong random state
    const state = crypto.randomBytes(32).toString('hex');

    // 2. Persist state in secure HttpOnly cookie (10 min TTL)
    res.cookie(OAUTH_STATE_COOKIE_NAME, state, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60 * 1000,
    });

    // 3. Persist validated return destination
    const safeReturnTo = this.authService.validateReturnUrl(returnTo);
    res.cookie(OAUTH_RETURN_TO_COOKIE_NAME, safeReturnTo, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60 * 1000,
    });

    // 4. Redirect to GitHub OAuth consent screen
    const authorizationUrl = this.authService.getAuthorizationUrl(state);
    return res.redirect(authorizationUrl);
  }

  /**
   * GET /auth/github/callback
   * OAuth 2.0 callback endpoint handling redirect from GitHub.
   * Validates CSRF state, exchanges code for access token, retrieves user profile,
   * creates/updates local user record, and issues secure HttpOnly JWT session cookie.
   */
  @Get('github/callback')
  @UseGuards(RateLimiterGuard)
  async gitHubCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const frontendUrl = this.authService.getFrontendUrl();
    const isProduction = process.env.NODE_ENV === 'production';

    const clearOAuthCookies = () => {
      res.clearCookie(OAUTH_STATE_COOKIE_NAME, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
      });
      res.clearCookie(OAUTH_RETURN_TO_COOKIE_NAME, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
      });
    };

    // 1. Handle user cancellation or OAuth error from GitHub
    if (error) {
      clearOAuthCookies();
      this.logger.warn(`GitHub OAuth error response: ${errorDescription || error}`);
      const errorMsg = encodeURIComponent(
        errorDescription || error || 'Authorization was cancelled or rejected by GitHub.',
      );
      return res.redirect(`${frontendUrl}?auth_error=${errorMsg}`);
    }

    // 2. Validate state to defend against CSRF attacks
    const storedState = req.cookies?.[OAUTH_STATE_COOKIE_NAME];
    if (!state || !storedState || state !== storedState) {
      clearOAuthCookies();
      this.logger.error('OAuth state mismatch detected (possible CSRF attempt)');
      return res.redirect(
        `${frontendUrl}?auth_error=${encodeURIComponent('Invalid OAuth state. Please try signing in again.')}`,
      );
    }

    if (!code) {
      clearOAuthCookies();
      return res.redirect(
        `${frontendUrl}?auth_error=${encodeURIComponent('Missing authorization code from GitHub.')}`,
      );
    }

    // Retrieve and clear stored return URL
    const storedReturnTo = req.cookies?.[OAUTH_RETURN_TO_COOKIE_NAME];
    const safeReturnTo = this.authService.validateReturnUrl(storedReturnTo);
    clearOAuthCookies();

    try {
      // 3. Exchange code for GitHub access token
      const accessToken = await this.authService.exchangeCodeForToken(code);

      // 4. Retrieve user profile from GitHub
      const profile = await this.authService.fetchGitHubProfile(accessToken);

      // 5. Create or retrieve local user in PostgreSQL
      const user = await this.authService.findOrCreateUser(profile);

      // 6. Generate signed JWT session token
      const sessionJwt = this.authService.generateJwt({
        id: user.id,
        username: user.username,
        email: user.email,
      });

      // 7. Set secure HttpOnly session cookie
      res.cookie(SESSION_COOKIE_NAME, sessionJwt, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      this.logger.log(`User ${user.username} successfully authenticated via GitHub`);
      return res.redirect(`${frontendUrl}${safeReturnTo}`);
    } catch (authErr: unknown) {
      this.logger.error(
        `GitHub authentication failed: ${authErr instanceof Error ? authErr.message : String(authErr)}`,
      );
      const message = encodeURIComponent(
        authErr instanceof Error ? authErr.message : 'Authentication failed. Please try again.',
      );
      return res.redirect(`${frontendUrl}?auth_error=${message}`);
    }
  }

  /**
   * GET /auth/me
   * Retrieves profile details for the currently authenticated user.
   * Protected by AuthGuard.
   */
  @Get('me')
  @UseGuards(AuthGuard)
  getCurrentUser(@CurrentUser() user: AuthenticatedUser) {
    return {
      user: {
        id: user.id,
        githubId: user.githubId,
        username: user.username,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
    };
  }

  /**
   * POST /auth/logout
   * Destroys the current server-managed session cookie.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });

    return {
      message: 'Successfully signed out.',
    };
  }
}
