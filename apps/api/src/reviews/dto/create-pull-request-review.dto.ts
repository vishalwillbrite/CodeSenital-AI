import { IsNotEmpty, IsUUID, IsInt, Min, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePullRequestReviewDto {
  @ValidateIf((o) => !o.repositoryId)
  @IsUUID('4', { message: 'repoId must be a valid UUIDv4' })
  @IsNotEmpty({ message: 'repoId must not be empty' })
  repoId?: string;

  @ValidateIf((o) => !o.repoId)
  @IsUUID('4', { message: 'repositoryId must be a valid UUIDv4' })
  @IsNotEmpty({ message: 'repositoryId must not be empty' })
  repositoryId?: string;

  @Type(() => Number)
  @IsInt({ message: 'pullNumber must be an integer' })
  @Min(1, { message: 'pullNumber must be at least 1' })
  @IsNotEmpty({ message: 'pullNumber must not be empty' })
  pullNumber!: number;

  get resolvedRepoId(): string {
    return (this.repoId || this.repositoryId)!;
  }
}
