import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import { GithubAppService } from './github-app.service';
import { ServiceUnavailableException, NotFoundException } from '@nestjs/common';

describe('GithubAppService', () => {
  let service: GithubAppService;
  let testPrivateKey: string;
  let testPublicKey: string;
  const originalEnv = process.env;

  beforeAll(() => {
    // Generate valid RSA keypair in memory for RS256 testing
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    testPrivateKey = privateKey;
    testPublicKey = publicKey;
  });

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.GITHUB_APP_ID = '123456';
    process.env.GITHUB_APP_SLUG = 'codesentinel-ai';
    process.env.GITHUB_APP_PRIVATE_KEY = testPrivateKey;
    service = new GithubAppService();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isConfigured', () => {
    it('should return true when GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY are set', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('should return false when GITHUB_APP_ID is missing', () => {
      delete process.env.GITHUB_APP_ID;
      expect(service.isConfigured()).toBe(false);
    });

    it('should return false when GITHUB_APP_PRIVATE_KEY is missing', () => {
      delete process.env.GITHUB_APP_PRIVATE_KEY;
      expect(service.isConfigured()).toBe(false);
    });
  });

  describe('generateAppJwt', () => {
    it('should generate a valid RS256 JWT signed with the private key', () => {
      const token = service.generateAppJwt();
      expect(typeof token).toBe('string');

      // Verify with the corresponding public key
      const decoded = jwt.verify(token, testPublicKey, { algorithms: ['RS256'] }) as jwt.JwtPayload;
      expect(decoded.iss).toBe('123456');
      expect(decoded.exp).toBeGreaterThan(decoded.iat!);
    });

    it('should throw ServiceUnavailableException if credentials are missing', () => {
      delete process.env.GITHUB_APP_ID;
      expect(() => service.generateAppJwt()).toThrow(ServiceUnavailableException);
    });
  });

  describe('getInstallationToken caching', () => {
    it('should request installation token from GitHub API and cache it', async () => {
      const futureExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour future
      const mockFetch = jest.spyOn(global, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve({ token: 'ghs_token_abc_123', expires_at: futureExpiry }),
        } as unknown as Response),
      );

      // First call -> triggers network request
      const token1 = await service.getInstallationToken('inst-100');
      expect(token1).toBe('ghs_token_abc_123');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call immediately after -> returns cached token without network request
      const token2 = await service.getInstallationToken('inst-100');
      expect(token2).toBe('ghs_token_abc_123');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Evict token
      service.evictToken('inst-100');

      // Third call -> triggers network request again
      const token3 = await service.getInstallationToken('inst-100');
      expect(token3).toBe('ghs_token_abc_123');
      expect(mockFetch).toHaveBeenCalledTimes(2);

      mockFetch.mockRestore();
    });

    it('should throw NotFoundException if installation is not found on GitHub', async () => {
      const mockFetch = jest.spyOn(global, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ message: 'Not Found' }),
        } as unknown as Response),
      );

      await expect(service.getInstallationToken('non-existent-inst')).rejects.toThrow(
        NotFoundException,
      );

      mockFetch.mockRestore();
    });
  });
});
