import path from 'path';
import fs from 'fs';
import { BadRequestException } from '@nestjs/common';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../reviews/dto/create-review.dto';

export const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg', '.bmp', '.tiff',
  '.pdf', '.zip', '.tar', '.gz', '.tgz', '.rar', '.7z', '.bz2',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.wasm', '.obj', '.o',
  '.mp3', '.mp4', '.wav', '.avi', '.mov', '.mkv', '.webm',
  '.ttf', '.woff', '.woff2', '.eot', '.otf',
  '.lock', '.lockb', // lockfiles
  '.min.js', '.min.css', // minified bundles
]);

export const EXTENSION_TO_LANGUAGE_MAP: Record<string, SupportedLanguage> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.h': 'c',
  '.c': 'c',
  '.cs': 'csharp',
  '.php': 'php',
  '.rb': 'ruby',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.scala': 'scala',
  '.sql': 'sql',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'css',
  '.sh': 'shell',
  '.bash': 'bash',
};

/**
 * Validates and normalizes repository paths, rejecting directory traversal,
 * null bytes, and absolute paths.
 */
export function sanitizeRepoPath(rawPath: string): string {
  if (!rawPath || typeof rawPath !== 'string') {
    throw new BadRequestException('File path must be a non-empty string');
  }

  // Defend against null-byte injection
  if (rawPath.includes('\0')) {
    throw new BadRequestException('Path traversal or null-byte injection attempt detected');
  }

  // Normalize path using POSIX forward-slashes
  const normalized = path.posix.normalize(rawPath.trim().replace(/\\/g, '/'));

  // Disallow escaping repository root
  if (
    normalized === '.' ||
    normalized.startsWith('..') ||
    normalized.startsWith('/') ||
    normalized.includes('/../') ||
    normalized.endsWith('/..') ||
    /^[a-zA-Z]:/.test(normalized) // Windows drive letter
  ) {
    throw new BadRequestException('Invalid path: path traversal outside repository root is forbidden');
  }

  return normalized;
}

/**
 * Checks whether a given file path is a known binary or non-source asset.
 */
export function isBinaryFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  for (const ext of BINARY_EXTENSIONS) {
    if (lower.endsWith(ext)) {
      return true;
    }
  }
  return false;
}

/**
 * Determines whether a file is an eligible code file for analysis.
 */
export function isEligibleCodeFile(filePath: string): boolean {
  if (isBinaryFile(filePath)) return false;

  // Filter out lockfiles and common non-code files
  const filename = path.posix.basename(filePath).toLowerCase();
  if (
    filename === 'package-lock.json' ||
    filename === 'yarn.lock' ||
    filename === 'pnpm-lock.yaml' ||
    filename === 'composer.lock' ||
    filename === 'cargo.lock' ||
    filename === 'gemfile.lock' ||
    filename.startsWith('.git')
  ) {
    return false;
  }

  const ext = path.posix.extname(filePath).toLowerCase();
  return Boolean(EXTENSION_TO_LANGUAGE_MAP[ext]);
}

/**
 * Detects programming language supported by CodeSentinel AI from file extension.
 */
export function detectLanguageFromPath(filePath: string): SupportedLanguage {
  const ext = path.posix.extname(filePath).toLowerCase();
  const detected = EXTENSION_TO_LANGUAGE_MAP[ext];
  if (detected && (SUPPORTED_LANGUAGES as readonly string[]).includes(detected)) {
    return detected;
  }
  return 'typescript'; // Safe default
}

/**
 * Formats multi-line or escaped PEM RSA private keys from environment variables.
 */
export function parsePrivateKey(rawKey: string): string {
  if (!rawKey || typeof rawKey !== 'string') return '';
  let key = rawKey.trim();

  // Check if rawKey is a file path to an existing PEM file on disk
  try {
    if (fs.existsSync(key)) {
      return fs.readFileSync(key, 'utf8').trim();
    }
  } catch {
    // Not a file path or unreadable, continue parsing as raw string
  }

  // Strip wrapping quotes
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }

  // Replace literal '\n' with actual line breaks
  key = key.replace(/\\n/g, '\n');

  // Decode base64 if provided without headers
  if (!key.includes('BEGIN') && !key.includes('\n')) {
    try {
      const decoded = Buffer.from(key, 'base64').toString('utf8');
      if (decoded.includes('BEGIN')) {
        return decoded;
      }
    } catch {
      // ignore
    }
  }

  return key;
}
