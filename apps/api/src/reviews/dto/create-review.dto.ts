import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Transform } from 'class-transformer';

// Supported programming languages for review
export const SUPPORTED_LANGUAGES = [
  'typescript',
  'javascript',
  'python',
  'go',
  'rust',
  'java',
  'cpp',
  'c',
  'csharp',
  'php',
  'ruby',
  'swift',
  'kotlin',
  'scala',
  'sql',
  'html',
  'css',
  'shell',
  'bash',
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// Configurable maximum source code length in characters (default 64 KB = 65,536 chars)
const parsedEnvLimit = parseInt(process.env.MAX_SOURCE_CODE_LENGTH || '', 10);
export const MAX_SOURCE_CODE_LENGTH =
  !isNaN(parsedEnvLimit) && parsedEnvLimit > 0 ? parsedEnvLimit : 65536;

@ValidatorConstraint({ name: 'isNonWhitespace', async: false })
export class IsNonWhitespaceConstraint implements ValidatorConstraintInterface {
  validate(text: unknown) {
    return typeof text === 'string' && text.trim().length > 0;
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must not be empty or contain only whitespace.`;
  }
}

@ValidatorConstraint({ name: 'isSupportedLanguage', async: false })
export class IsSupportedLanguageConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    if (typeof value !== 'string') return false;
    const normalized = value.toLowerCase().trim();
    return (SUPPORTED_LANGUAGES as readonly string[]).includes(normalized);
  }

  defaultMessage(args: ValidationArguments) {
    return `Language '${args.value}' is not supported. Supported languages are: ${SUPPORTED_LANGUAGES.join(', ')}.`;
  }
}

export class CreateReviewDto {
  @IsString({ message: 'sourceCode must be a string' })
  @IsNotEmpty({ message: 'sourceCode must not be empty' })
  @Validate(IsNonWhitespaceConstraint)
  @MaxLength(MAX_SOURCE_CODE_LENGTH, {
    message: `sourceCode exceeds the maximum allowed size of ${MAX_SOURCE_CODE_LENGTH} characters (~${Math.round(MAX_SOURCE_CODE_LENGTH / 1024)} KB).`,
  })
  sourceCode!: string;

  @IsString({ message: 'language must be a string' })
  @IsNotEmpty({ message: 'language must not be empty' })
  @Validate(IsNonWhitespaceConstraint)
  @MaxLength(50, { message: 'language name must not exceed 50 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  @Validate(IsSupportedLanguageConstraint)
  language!: string;

  @IsOptional()
  @IsString({ message: 'userId must be a string' })
  userId?: string;
}
