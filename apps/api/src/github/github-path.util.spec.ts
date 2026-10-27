import {
  sanitizeRepoPath,
  isBinaryFile,
  isEligibleCodeFile,
  detectLanguageFromPath,
  parsePrivateKey,
} from './github-path.util';
import { BadRequestException } from '@nestjs/common';

describe('github-path.util', () => {
  describe('sanitizeRepoPath', () => {
    it('should normalize safe relative paths', () => {
      expect(sanitizeRepoPath('src/main.ts')).toBe('src/main.ts');
      expect(sanitizeRepoPath('apps/web/src/index.tsx')).toBe('apps/web/src/index.tsx');
      expect(sanitizeRepoPath('./components/button.tsx')).toBe('components/button.tsx');
      expect(sanitizeRepoPath('src\\controllers\\app.ts')).toBe('src/controllers/app.ts');
    });

    it('should throw BadRequestException on path traversal attempts escaping root', () => {
      expect(() => sanitizeRepoPath('../etc/passwd')).toThrow(BadRequestException);
      expect(() => sanitizeRepoPath('src/../../etc/passwd')).toThrow(BadRequestException);
      expect(() => sanitizeRepoPath('..')).toThrow(BadRequestException);
      expect(() => sanitizeRepoPath('dir/..')).toThrow(BadRequestException);
    });

    it('should throw BadRequestException on absolute paths and drive letters', () => {
      expect(() => sanitizeRepoPath('/etc/passwd')).toThrow(BadRequestException);
      expect(() => sanitizeRepoPath('/root/secrets.env')).toThrow(BadRequestException);
      expect(() => sanitizeRepoPath('C:\\Windows\\System32')).toThrow(BadRequestException);
      expect(() => sanitizeRepoPath('D:/projects/repo')).toThrow(BadRequestException);
    });

    it('should throw BadRequestException on null-byte injection', () => {
      expect(() => sanitizeRepoPath('src/main.ts\0.png')).toThrow(BadRequestException);
    });

    it('should throw BadRequestException on empty or non-string paths', () => {
      expect(() => sanitizeRepoPath('')).toThrow(BadRequestException);
      expect(() => sanitizeRepoPath(null as unknown as string)).toThrow(BadRequestException);
    });
  });

  describe('isBinaryFile', () => {
    it('should identify binary file extensions', () => {
      expect(isBinaryFile('image.png')).toBe(true);
      expect(isBinaryFile('photo.JPG')).toBe(true);
      expect(isBinaryFile('binary.wasm')).toBe(true);
      expect(isBinaryFile('archive.tar.gz')).toBe(true);
      expect(isBinaryFile('app.exe')).toBe(true);
      expect(isBinaryFile('bundle.min.js')).toBe(true);
      expect(isBinaryFile('package-lock.json')).toBe(false);
    });

    it('should return false for source code files', () => {
      expect(isBinaryFile('main.ts')).toBe(false);
      expect(isBinaryFile('app.py')).toBe(false);
      expect(isBinaryFile('server.go')).toBe(false);
    });
  });

  describe('isEligibleCodeFile', () => {
    it('should identify valid code files', () => {
      expect(isEligibleCodeFile('src/auth.ts')).toBe(true);
      expect(isEligibleCodeFile('lib/utils.py')).toBe(true);
      expect(isEligibleCodeFile('main.go')).toBe(true);
      expect(isEligibleCodeFile('styles.css')).toBe(true);
    });

    it('should filter out lockfiles and binary assets', () => {
      expect(isEligibleCodeFile('package-lock.json')).toBe(false);
      expect(isEligibleCodeFile('yarn.lock')).toBe(false);
      expect(isEligibleCodeFile('pnpm-lock.yaml')).toBe(false);
      expect(isEligibleCodeFile('logo.png')).toBe(false);
      expect(isEligibleCodeFile('unknown.xyz123')).toBe(false);
    });
  });

  describe('detectLanguageFromPath', () => {
    it('should map extensions to supported languages', () => {
      expect(detectLanguageFromPath('src/index.ts')).toBe('typescript');
      expect(detectLanguageFromPath('src/App.tsx')).toBe('typescript');
      expect(detectLanguageFromPath('server.js')).toBe('javascript');
      expect(detectLanguageFromPath('model.py')).toBe('python');
      expect(detectLanguageFromPath('main.go')).toBe('go');
      expect(detectLanguageFromPath('lib.rs')).toBe('rust');
      expect(detectLanguageFromPath('Main.java')).toBe('java');
      expect(detectLanguageFromPath('query.sql')).toBe('sql');
      expect(detectLanguageFromPath('deploy.sh')).toBe('shell');
    });

    it('should default to typescript for unrecognized files', () => {
      expect(detectLanguageFromPath('Dockerfile')).toBe('typescript');
    });
  });

  describe('parsePrivateKey', () => {
    it('should replace literal escaped newlines with actual line breaks', () => {
      const raw = '-----BEGIN RSA PRIVATE KEY-----\\nMIIE...\\n-----END RSA PRIVATE KEY-----';
      const parsed = parsePrivateKey(raw);
      expect(parsed).toContain('\n');
      expect(parsed.includes('\\n')).toBe(false);
    });

    it('should strip surrounding quotes', () => {
      const raw = '"-----BEGIN RSA PRIVATE KEY-----\\nKEY\\n-----END RSA PRIVATE KEY-----"';
      const parsed = parsePrivateKey(raw);
      expect(parsed.startsWith('"')).toBe(false);
      expect(parsed.endsWith('"')).toBe(false);
    });
  });
});
