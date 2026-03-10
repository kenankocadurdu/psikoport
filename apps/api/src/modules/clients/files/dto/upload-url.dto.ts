import { IsString, IsNotEmpty, Matches, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UploadUrlDto {
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^.+\/.+$/, {
    message: 'contentType must be valid MIME type (e.g. application/pdf)',
  })
  contentType!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  fileSize?: number;
}
