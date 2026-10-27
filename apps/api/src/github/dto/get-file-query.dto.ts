import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class GetFileQueryDto {
  @IsString({ message: 'path must be a string' })
  @IsNotEmpty({ message: 'path must not be empty' })
  path!: string;

  @IsOptional()
  @IsString({ message: 'ref must be a string' })
  ref?: string;
}
