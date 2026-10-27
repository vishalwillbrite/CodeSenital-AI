import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  BadGatewayException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { parsePrivateKey } from './github-path.util';
import type { GitHubAppConfig, GitHubInstallationToken } from './github.types';

@Injectable()
export class GithubAppService {
  private readonly logger = new Logger(GithubAppService.name);

  // In-memory token cache: installationId -> { token, expiresAt }
  private readonly tokenCache = new Map<string, GitHubInstallationToken>();

  /**
   * Checks whether GitHub App credentials are fully configured.
   */
  isConfigured(): boolean {
    const config = this.getConfig();
    return Boolean(config.appId && config.privateKey);
  }

  /**
   * Retrieves GitHub App configuration from environment variables.
   */
  getConfig(): GitHubAppConfig {
    const appId = process.env.GITHUB_APP_ID?.trim() || null;
    const appSlug = process.env.GITHUB_APP_SLUG?.trim() || null;
    const rawKey = process.env.GITHUB_APP_PRIVATE_KEY || null;
    const privateKey = rawKey ? parsePrivateKey(rawKey) : null;
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET?.trim() || null;

    return {
      appId,
      appSlug,
      privateKey,
      webhookSecret,
    };
  }

  getAppSlug(): string {
    const raw = this.getConfig().appSlug;
    if (!raw) {
      // Fallback to default name if slug not set
      return 'codesentinel-ai';
    }
    const trimmed = raw.trim().replace(/\/+$/, '');
    const lastSegment = trimmed.split('/').pop();
    return lastSegment || 'codesentinel-ai';
  }

  /**
   * Generates a signed GitHub App JWT using RS256 algorithm (10-minute expiry).
   */
  generateAppJwt(): string {
    const config = this.getConfig();
    if (!config.appId || !config.privateKey) {
      throw new ServiceUnavailableException(
        'GitHub App integration is not configured. Please set GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY in .env.',
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iat: now - 60, // 60 seconds in the past to compensate for clock drift
      exp: now + 10 * 60, // 10 minutes maximum allowed by GitHub
      iss: config.appId,
    };

    try {
      return jwt.sign(payload, config.privateKey, {
        algorithm: 'RS256',
      });
    } catch (signErr: unknown) {
      this.logger.error(
        `Failed to sign GitHub App JWT: ${signErr instanceof Error ? signErr.message : String(signErr)}`,
      );
      throw new ServiceUnavailableException(
        'Failed to sign GitHub App token. Please verify GITHUB_APP_PRIVATE_KEY is a valid RSA private key in PEM format.',
      );
    }
  }

  /**
   * Obtains an installation access token for the given installation ID.
   * Utilizes in-memory caching with a 5-minute safety threshold prior to expiration.
   */
  async getInstallationToken(installationId: string): Promise<string> {
    const now = Date.now();
    const cached = this.tokenCache.get(installationId);

    // If cached token is valid for at least 5 more minutes (300,000 ms), reuse it
    if (cached && cached.expiresAt - now > 5 * 60 * 1000) {
      return cached.token;
    }

    const appJwt = this.generateAppJwt();
    const url = `https://api.github.com/app/installations/${installationId}/access_tokens`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${appJwt}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'CodeSentinel-AI',
        },
      });

      if (!res.ok) {
        if (res.status === 404) {
          throw new NotFoundException(
            `GitHub App installation '${installationId}' not found or has been uninstalled.`,
          );
        }
        if (res.status === 401 || res.status === 403) {
          throw new UnauthorizedException(
            'GitHub rejected app credentials when requesting installation access token.',
          );
        }
        throw new BadGatewayException(
          `GitHub API error requesting installation token: HTTP ${res.status}`,
        );
      }

      const data = (await res.json()) as { token: string; expires_at: string };
      const expiresAt = new Date(data.expires_at).getTime();

      // Update cache
      this.tokenCache.set(installationId, {
        token: data.token,
        expiresAt,
      });

      this.logger.log(`Obtained new installation access token for installation '${installationId}'`);
      return data.token;
    } catch (err: unknown) {
      if (
        err instanceof ServiceUnavailableException ||
        err instanceof NotFoundException ||
        err instanceof UnauthorizedException ||
        err instanceof BadGatewayException
      ) {
        throw err;
      }
      this.logger.error(
        `Error requesting GitHub installation token: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadGatewayException('Could not connect to GitHub App API.');
    }
  }

  /**
   * Helper to perform authenticated requests to GitHub API using App JWT.
   */
  async requestAsApp<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const appJwt = this.generateAppJwt();
    const url = endpoint.startsWith('http') ? endpoint : `https://api.github.com${endpoint}`;

    const headers = {
      Authorization: `Bearer ${appJwt}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'CodeSentinel-AI',
      ...(options.headers || {}),
    };

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.warn(`GitHub App request failed: ${res.status} ${url} - ${body.substring(0, 200)}`);
      if (res.status === 404) throw new NotFoundException('Requested GitHub resource not found.');
      if (res.status === 403) throw new BadGatewayException('GitHub API rate limit or permission error.');
      throw new BadGatewayException(`GitHub API error: HTTP ${res.status}`);
    }

    return (await res.json()) as T;
  }

  /**
   * Helper to perform authenticated requests using Installation Access Token.
   */
  async requestAsInstallation<T>(
    installationId: string,
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const token = await this.getInstallationToken(installationId);
    const url = endpoint.startsWith('http') ? endpoint : `https://api.github.com${endpoint}`;

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'CodeSentinel-AI',
      ...(options.headers || {}),
    };

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.warn(`GitHub Installation request failed: ${res.status} ${url} - ${body.substring(0, 200)}`);
      if (res.status === 404) throw new NotFoundException('Repository or resource not found on GitHub.');
      if (res.status === 403) throw new BadGatewayException('GitHub API rate limit exceeded or access forbidden.');
      throw new BadGatewayException(`GitHub API error: HTTP ${res.status}`);
    }

    return (await res.json()) as T;
  }

  /**
   * Clears cached token for an installation (e.g. On disconnect).
   */
  evictToken(installationId: string) {
    this.tokenCache.delete(installationId);
  }
}
