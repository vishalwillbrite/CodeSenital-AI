import { IsNotEmpty, IsString, IsUUID, IsOptional, ValidateIf } from 'class-validator';

export class CreateRepoFileReviewDto {
  @ValidateIf((o) => !o.repositoryId)
  @IsUUID('4', { message: 'repoId must be a valid UUIDv4' })
  @IsNotEmpty({ message: 'repoId must not be empty' })
  repoId?: string;

  @ValidateIf((o) => !o.repoId)
  @IsUUID('4', { message: 'repositoryId must be a valid UUIDv4' })
  @IsNotEmpty({ message: 'repositoryId must not be empty' })
  repositoryId?: string;

  @ValidateIf((o) => !o.filePath)
  @IsString({ message: 'path must be a string' })
  @IsNotEmpty({ message: 'path must not be empty' })
  path?: string;

  @ValidateIf((o) => !o.path)
  @IsString({ message: 'filePath must be a string' })
  @IsNotEmpty({ message: 'filePath must not be empty' })
  filePath?: string;

  @IsOptional()
  @IsString({ message: 'ref must be a string' })
  ref?: string;

  get resolvedRepoId(): string {
    return (this.repoId || this.repositoryId)!;
  }

  get resolvedPath(): string {
    return (this.path || this.filePath)!;
  }
}
