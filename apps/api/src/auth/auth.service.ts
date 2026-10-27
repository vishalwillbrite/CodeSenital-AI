import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  BadGatewayException,
  UnauthorizedException,
} from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AuthenticatedUser,
  GitHubTokenResponse,
  GitHubUserEmail,
  GitHubUserProfile,
  JwtPayload,
} from './auth.types';

export const SESSION_COOKIE_NAME = 'codesentinel_session';
export const OAUTH_STATE_COOKIE_NAME = 'codesentinel_oauth_state';
export const OAUTH_RETURN_TO_COOKIE_NAME = 'codesentinel_oauth_return_to';

const DEFAULT_JWT_SECRET = 'codesentinel_dev_secret_key_change_in_production';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Checks whether GitHub OAuth credentials are configured in the environment.
   */
  isOAuthConfigured(): boolean {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();
    return Boolean(clientId && clientSecret);
  }

  getClientId(): string | null {
    return process.env.GITHUB_CLIENT_ID?.trim() || null;
  }

  getClientSecret(): string | null {
    return process.env.GITHUB_CLIENT_SECRET?.trim() || null;
  }

  getFrontendUrl(): string {
    return process.env.FRONTEND_URL?.trim() || 'http://localhost:3000';
  }

  getCallbackUrl(): string {
    if (process.env.GITHUB_CALLBACK_URL) {
      return process.env.GITHUB_CALLBACK_URL.trim();
    }
    const backendPort = process.env.PORT || '4000';
    return `http://localhost:${backendPort}/auth/github/callback`;
  }

  private getJwtSecret(): string {
    const secret = process.env.JWT_SECRET?.trim();
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        this.logger.error('CRITICAL: JWT_SECRET is not configured in production environment!');
      }
      return DEFAULT_JWT_SECRET;
    }
    return secret;
  }

  /**
   * Constructs GitHub OAuth authorization URL.
   */
  getAuthorizationUrl(state: string): string {
    const clientId = this.getClientId();
    if (!clientId) {
      throw new ServiceUnavailableException(
        'GitHub OAuth is not configured. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in environment variables.',
      );
    }

    const redirectUri = encodeURIComponent(this.getCallbackUrl());
    const scope = encodeURIComponent('read:user user:email');
    return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${encodeURIComponent(state)}`;
  }

  /**
   * Exchanges an authorization code for a GitHub access token.
   */
  async exchangeCodeForToken(code: string): Promise<string> {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();

    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        'GitHub OAuth credentials are not configured on the server.',
      );
    }

    try {
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'CodeSentinel-AI',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: this.getCallbackUrl(),
        }),
      });

      if (!response.ok) {
        throw new BadGatewayException(
          `GitHub OAuth token exchange failed with HTTP status ${response.status}`,
        );
      }

      const data = (await response.json()) as GitHubTokenResponse;

      if (data.error || !data.access_token) {
        this.logger.warn(`GitHub token exchange error: ${data.error_description || data.error}`);
        throw new UnauthorizedException(
          data.error_description || 'GitHub authorization failed or authorization code expired.',
        );
      }

      return data.access_token;
    } catch (err: unknown) {
      if (err instanceof ServiceUnavailableException || err instanceof UnauthorizedException) {
        throw err;
      }
      this.logger.error(`Error during GitHub token exchange: ${err instanceof Error ? err.message : String(err)}`);
      throw new BadGatewayException('Could not connect to GitHub authorization service.');
    }
  }

  /**
   * Fetches the user profile from GitHub API, falling back to /user/emails if public email is not set.
   */
  async fetchGitHubProfile(accessToken: string): Promise<GitHubUserProfile & { primaryEmail: string | null }> {
    try {
      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'CodeSentinel-AI',
        },
      });

      if (!userRes.ok) {
        throw new BadGatewayException(
          `Failed to fetch user profile from GitHub (HTTP ${userRes.status})`,
        );
      }

      const profile = (await userRes.json()) as GitHubUserProfile;
      let primaryEmail = profile.email;

      // If email is private/null, query user/emails to find the primary verified email
      if (!primaryEmail) {
        try {
          const emailRes = await fetch('https://api.github.com/user/emails', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/vnd.github+json',
              'User-Agent': 'CodeSentinel-AI',
            },
          });

          if (emailRes.ok) {
            const emails = (await emailRes.json()) as GitHubUserEmail[];
            const primaryObj = emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified) || emails[0];
            if (primaryObj) {
              primaryEmail = primaryObj.email;
            }
          }
        } catch (emailErr) {
          this.logger.warn(`Could not fetch GitHub private emails: ${emailErr instanceof Error ? emailErr.message : String(emailErr)}`);
        }
      }

      // If still no email, construct a deterministic GitHub noreply email
      if (!primaryEmail && profile.id && profile.login) {
        primaryEmail = `${profile.id}+${profile.login}@users.noreply.github.com`;
      }

      return {
        ...profile,
        primaryEmail: primaryEmail || null,
      };
    } catch (err: unknown) {
      if (err instanceof BadGatewayException) throw err;
      this.logger.error(`Error fetching GitHub user profile: ${err instanceof Error ? err.message : String(err)}`);
      throw new BadGatewayException('Failed to retrieve profile data from GitHub.');
    }
  }

  /**
   * Finds or creates a local user associated with the verified GitHub profile.
   */
  async findOrCreateUser(
    profile: GitHubUserProfile & { primaryEmail: string | null },
  ): Promise<AuthenticatedUser> {
    const githubIdStr = String(profile.id);
    const emailToUse = profile.primaryEmail;

    // 1. Look up by GitHub account identifier
    let user = await this.prisma.user.findUnique({
      where: { githubId: githubIdStr },
    });

    if (user) {
      // Update profile info
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          username: profile.login,
          name: profile.name || profile.login,
          avatarUrl: profile.avatar_url,
          ...(emailToUse ? { email: emailToUse } : {}),
        },
      });
      return user;
    }

    // 2. If not found by githubId, check if existing user matches primary email
    if (emailToUse) {
      user = await this.prisma.user.findUnique({
        where: { email: emailToUse },
      });

      if (user) {
        // Link GitHub account to existing user
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            githubId: githubIdStr,
            username: profile.login,
            name: user.name || profile.name || profile.login,
            avatarUrl: profile.avatar_url,
          },
        });
        return user;
      }
    }

    // 3. Create brand-new authenticated user
    user = await this.prisma.user.create({
      data: {
        githubId: githubIdStr,
        username: profile.login,
        name: profile.name || profile.login,
        email: emailToUse,
        avatarUrl: profile.avatar_url,
      },
    });

    this.logger.log(`Created new authenticated user: ${user.username} (${user.id})`);
    return user;
  }

  /**
   * Generates a signed JWT session token for the user.
   */
  generateJwt(user: { id: string; username?: string | null; email?: string | null }): string {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username || undefined,
      email: user.email || undefined,
    };

    return jwt.sign(payload, this.getJwtSecret(), {
      expiresIn: '7d',
      algorithm: 'HS256',
    });
  }

  /**
   * Verifies and decodes a signed JWT session token.
   */
  verifyJwt(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, this.getJwtSecret(), {
        algorithms: ['HS256'],
      }) as JwtPayload;

      if (!decoded || !decoded.sub) {
        throw new UnauthorizedException('Invalid session token payload.');
      }

      return decoded;
    } catch (err: unknown) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException(
        err instanceof Error && err.name === 'TokenExpiredError'
          ? 'Session has expired. Please sign in again.'
          : 'Invalid or forged session token.',
      );
    }
  }

  /**
   * Validates and normalizes relative redirect destination URLs to prevent open redirect vulnerabilities.
   */
  validateReturnUrl(returnUrl?: string | null): string {
    if (!returnUrl || typeof returnUrl !== 'string') {
      return '/';
    }

    const trimmed = returnUrl.trim();
    // Must start with '/' and must NOT start with '//' or '/\' or contain scheme indicators ':'
    if (
      trimmed.startsWith('/') &&
      !trimmed.startsWith('//') &&
      !trimmed.startsWith('/\\') &&
      !trimmed.includes(':')
    ) {
      return trimmed;
    }

    return '/';
  }
}
