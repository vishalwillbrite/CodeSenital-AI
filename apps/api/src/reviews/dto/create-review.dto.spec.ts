import { validate } from 'class-validator';
import { CreateReviewDto, MAX_SOURCE_CODE_LENGTH } from './create-review.dto';

describe('CreateReviewDto Validation', () => {
  it('should pass with valid source code and language', async () => {
    const dto = new CreateReviewDto();
    dto.sourceCode = 'function add(a, b) { return a + b; }';
    dto.language = 'typescript';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should pass for various supported languages', async () => {
    for (const lang of ['javascript', 'python', 'go', 'rust', 'java', 'cpp', 'csharp', 'sql', 'bash']) {
      const dto = new CreateReviewDto();
      dto.sourceCode = '// code snippet';
      dto.language = lang;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    }
  });

  it('should fail when language is unsupported', async () => {
    const dto = new CreateReviewDto();
    dto.sourceCode = 'print("hello")';
    dto.language = 'unsupported_lang_xyz';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const langError = errors.find((e) => e.property === 'language');
    expect(langError).toBeDefined();
    expect(langError?.constraints).toHaveProperty('isSupportedLanguage');
  });

  it('should fail when sourceCode is empty string', async () => {
    const dto = new CreateReviewDto();
    dto.sourceCode = '';
    dto.language = 'javascript';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const sourceCodeError = errors.find((e) => e.property === 'sourceCode');
    expect(sourceCodeError).toBeDefined();
  });

  it('should fail when sourceCode contains only whitespace', async () => {
    const dto = new CreateReviewDto();
    dto.sourceCode = '   \n\t   ';
    dto.language = 'python';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const sourceCodeError = errors.find((e) => e.property === 'sourceCode');
    expect(sourceCodeError).toBeDefined();
    expect(sourceCodeError?.constraints).toHaveProperty('isNonWhitespace');
  });

  it('should fail when sourceCode exceeds maximum allowed size (64 KB)', async () => {
    const dto = new CreateReviewDto();
    dto.sourceCode = 'a'.repeat(MAX_SOURCE_CODE_LENGTH + 1);
    dto.language = 'python';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const sourceCodeError = errors.find((e) => e.property === 'sourceCode');
    expect(sourceCodeError).toBeDefined();
    expect(sourceCodeError?.constraints).toHaveProperty('maxLength');
  });

  it('should pass when sourceCode is exactly at maximum allowed size', async () => {
    const dto = new CreateReviewDto();
    dto.sourceCode = 'a'.repeat(MAX_SOURCE_CODE_LENGTH);
    dto.language = 'python';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail when language is missing or empty', async () => {
    const dto = new CreateReviewDto();
    dto.sourceCode = 'print("hello")';
    dto.language = '';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const langError = errors.find((e) => e.property === 'language');
    expect(langError).toBeDefined();
  });

  it('should fail when language exceeds 50 characters', async () => {
    const dto = new CreateReviewDto();
    dto.sourceCode = 'print("hello")';
    dto.language = 'a'.repeat(51);

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const langError = errors.find((e) => e.property === 'language');
    expect(langError).toBeDefined();
    expect(langError?.constraints).toHaveProperty('maxLength');
  });
});
