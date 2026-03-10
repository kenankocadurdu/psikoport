import {
  IsOptional,
  IsString,
  IsIn,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

const COMPLETION_STATUSES = ['DRAFT', 'COMPLETE', 'EXPIRED'] as const;

export class FormSubmissionQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(COMPLETION_STATUSES)
  completionStatus?: (typeof COMPLETION_STATUSES)[number];

  @IsOptional()
  @IsString()
  formDefinitionId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
