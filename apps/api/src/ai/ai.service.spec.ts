import { jest } from '@jest/globals';
import {
  BadGatewayException,
  RequestTimeoutException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiService, AI_ADVISORY_DISCLAIMER } from './ai.service';
import type { GoogleGenAI } from '@google/genai';

describe('AiService', () => {
  let service: AiService;
  const originalEnv = process.env;

  beforeEach(() => {
    service = new AiService();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('Missing API key handling', () => {
    it('should throw ServiceUnavailableException when GEMINI_API_KEY is not configured', async () => {
      delete process.env.AI_API_KEY;
      delete process.env.GEMINI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      // Mock getApiKey to ensure test doesn't read from an existing local .env
      jest.spyOn(service, 'getApiKey').mockReturnValue(null);

      await expect(
        service.reviewCode({
          sourceCode: 'console.log("test");',
          language: 'javascript',
        }),
      ).rejects.toThrow(ServiceUnavailableException);

      await expect(
        service.reviewCode({
          sourceCode: 'console.log("test");',
          language: 'javascript',
        }),
      ).rejects.toThrow(
        /Gemini AI review service is not configured\. Please set GEMINI_API_KEY/,
      );
    });
  });

  describe('Response Parsing and Validation', () => {
    it('should parse and validate a well-formed structured JSON response', () => {
      const mockRawOutput = JSON.stringify({
        summary: 'The code is generally clean but has a potential timing attack.',
        overallRisk: 'medium',
        findings: [
          {
            title: 'Insecure string comparison',
            description:
              'Direct string equality may be vulnerable to timing analysis attacks.',
            severity: 'HIGH',
            category: 'security',
            lineStart: 12,
            lineEnd: 12,
            suggestedFix: 'crypto.timingSafeEqual(bufA, bufB)',
          },
        ],
      });

      const result = service.parseAndValidateResponse(mockRawOutput);

      expect(result.summary).toBe(
        'The code is generally clean but has a potential timing attack.',
      );
      expect(result.overallRisk).toBe('medium');
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]).toEqual({
        title: 'Insecure string comparison',
        description:
          'Direct string equality may be vulnerable to timing analysis attacks.',
        severity: 'HIGH',
        category: 'security',
        lineStart: 12,
        lineEnd: 12,
        suggestedFix: 'crypto.timingSafeEqual(bufA, bufB)',
      });
      expect(result.disclaimer).toBe(AI_ADVISORY_DISCLAIMER);
    });

    it('should strip markdown code fences (```json ... ```) before parsing', () => {
      const mockRawOutput = `\`\`\`json
{
  "summary": "Clean Python code without issues.",
  "overallRisk": "none",
  "findings": []
}
\`\`\``;

      const result = service.parseAndValidateResponse(mockRawOutput);

      expect(result.overallRisk).toBe('none');
      expect(result.findings).toHaveLength(0);
      expect(result.summary).toBe('Clean Python code without issues.');
    });

    it('should throw BadGatewayException for malformed JSON output', () => {
      const malformedJson = '{ summary: "Unclosed json... ';

      expect(() =>
        service.parseAndValidateResponse(malformedJson),
      ).toThrow(BadGatewayException);

      expect(() =>
        service.parseAndValidateResponse(malformedJson),
      ).toThrow(/Gemini provider returned malformed JSON output/);
    });

    it('should throw BadGatewayException if summary is missing', () => {
      const missingSummary = JSON.stringify({
        overallRisk: 'low',
        findings: [],
      });

      expect(() =>
        service.parseAndValidateResponse(missingSummary),
      ).toThrow(BadGatewayException);

      expect(() =>
        service.parseAndValidateResponse(missingSummary),
      ).toThrow(/missing a valid string "summary" field/);
    });

    it('should throw BadGatewayException if findings is not an array', () => {
      const invalidFindings = JSON.stringify({
        summary: 'Valid summary',
        overallRisk: 'low',
        findings: 'none',
      });

      expect(() =>
        service.parseAndValidateResponse(invalidFindings),
      ).toThrow(BadGatewayException);

      expect(() =>
        service.parseAndValidateResponse(invalidFindings),
      ).toThrow(/missing an array of "findings"/);
    });

    it('should normalize severity case and invalid overallRisk values', () => {
      const raw = JSON.stringify({
        summary: 'Summary with unusual cases',
        overallRisk: 'EXTREME_DANGER', // invalid risk -> fallback to 'medium'
        findings: [
          {
            title: 'Issue',
            description: 'Desc',
            severity: 'critical', // lowercase
            category: 'SECURITY',
          },
        ],
      });

      const result = service.parseAndValidateResponse(raw);
      expect(result.overallRisk).toBe('medium');
      expect(result.findings[0].severity).toBe('CRITICAL');
      expect(result.findings[0].category).toBe('security');
    });
  });

  describe('Gemini SDK integration and error handling', () => {
    it('should call Gemini SDK and return validated findings on success', async () => {
      process.env.GEMINI_API_KEY = 'test-gemini-key';

      const mockModelOutput = JSON.stringify({
        summary: 'Code looks solid with no critical flaws.',
        overallRisk: 'low',
        findings: [
          {
            title: 'Use const instead of let',
            description: 'Variable is never reassigned.',
            severity: 'INFO',
            category: 'best-practice',
            lineStart: 1,
            lineEnd: 1,
            suggestedFix: 'const a = 1;',
          },
        ],
      });

      const mockGenerateContent = jest.fn().mockImplementation(() =>
        Promise.resolve({
          text: mockModelOutput,
        }),
      );

      jest.spyOn(service, 'getGoogleGenAiClient').mockReturnValue({
        models: {
          generateContent: mockGenerateContent,
        },
      } as unknown as GoogleGenAI);

      const result = await service.reviewCode({
        sourceCode: 'let a = 1;',
        language: 'javascript',
      });

      expect(mockGenerateContent).toHaveBeenCalled();
      expect(result.overallRisk).toBe('low');
      expect(result.summary).toBe('Code looks solid with no critical flaws.');
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].title).toBe('Use const instead of let');
    });

    it('should handle timeout error gracefully', async () => {
      process.env.GEMINI_API_KEY = 'test-key';

      const mockGenerateContent = jest.fn().mockImplementation(() => {
        const err = new Error('Request timed out');
        err.name = 'TimeoutError';
        return Promise.reject(err);
      });

      jest.spyOn(service, 'getGoogleGenAiClient').mockReturnValue({
        models: {
          generateContent: mockGenerateContent,
        },
      } as unknown as GoogleGenAI);

      await expect(
        service.reviewCode({
          sourceCode: 'const x = 1;',
          language: 'typescript',
        }),
      ).rejects.toThrow(RequestTimeoutException);
    });

    it('should handle 429 rate limit error gracefully', async () => {
      process.env.GEMINI_API_KEY = 'test-key';

      const mockGenerateContent = jest.fn().mockImplementation(() => {
        const err = new Error('429 RESOURCE_EXHAUSTED: Rate limit exceeded');
        return Promise.reject(err);
      });

      jest.spyOn(service, 'getGoogleGenAiClient').mockReturnValue({
        models: {
          generateContent: mockGenerateContent,
        },
      } as unknown as GoogleGenAI);

      await expect(
        service.reviewCode({
          sourceCode: 'const x = 1;',
          language: 'typescript',
        }),
      ).rejects.toThrow(BadGatewayException);

      await expect(
        service.reviewCode({
          sourceCode: 'const x = 1;',
          language: 'typescript',
        }),
      ).rejects.toThrow(/rate limit or quota exceeded/i);
    });

    it('should handle authentication errors (401/403) gracefully', async () => {
      process.env.GEMINI_API_KEY = 'invalid-key';

      const mockGenerateContent = jest.fn().mockImplementation(() => {
        const err = new Error('403 API key not valid. Please pass a valid API key.');
        return Promise.reject(err);
      });

      jest.spyOn(service, 'getGoogleGenAiClient').mockReturnValue({
        models: {
          generateContent: mockGenerateContent,
        },
      } as unknown as GoogleGenAI);

      await expect(
        service.reviewCode({
          sourceCode: 'const x = 1;',
          language: 'typescript',
        }),
      ).rejects.toThrow(BadGatewayException);

      await expect(
        service.reviewCode({
          sourceCode: 'const x = 1;',
          language: 'typescript',
        }),
      ).rejects.toThrow(/authentication failed/i);
    });

    it('should throw BadGatewayException when Gemini returns an empty response', async () => {
      process.env.GEMINI_API_KEY = 'test-key';

      const mockGenerateContent = jest.fn().mockImplementation(() =>
        Promise.resolve({
          text: '',
        }),
      );

      jest.spyOn(service, 'getGoogleGenAiClient').mockReturnValue({
        models: {
          generateContent: mockGenerateContent,
        },
      } as unknown as GoogleGenAI);

      await expect(
        service.reviewCode({
          sourceCode: 'const x = 1;',
          language: 'typescript',
        }),
      ).rejects.toThrow(BadGatewayException);

      await expect(
        service.reviewCode({
          sourceCode: 'const x = 1;',
          language: 'typescript',
        }),
      ).rejects.toThrow(/empty response/i);
    });

    it('should validate and clamp line references to within source code line count', () => {
      const sourceCode = 'line 1\nline 2\nline 3\nline 4\nline 5'; // 5 lines
      const mockRawOutput = JSON.stringify({
        summary: 'Bounds test',
        overallRisk: 'low',
        findings: [
          {
            title: 'Out of bounds test',
            description: 'Negative lineStart and exceeding lineEnd',
            severity: 'LOW',
            category: 'bug',
            lineStart: -5,
            lineEnd: 999,
          },
          {
            title: 'Inverted lines test',
            description: 'lineStart > lineEnd',
            severity: 'INFO',
            category: 'readability',
            lineStart: 4,
            lineEnd: 2,
          },
        ],
      });

      const result = service.parseAndValidateResponse(mockRawOutput, sourceCode);

      expect(result.findings[0].lineStart).toBe(1);
      expect(result.findings[0].lineEnd).toBe(5);
      expect(result.findings[1].lineStart).toBe(2);
      expect(result.findings[1].lineEnd).toBe(4);
    });
  });
});
