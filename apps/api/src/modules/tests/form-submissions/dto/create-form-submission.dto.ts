import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsIn,
} from 'class-validator';

const COMPLETION_STATUSES = ['DRAFT', 'COMPLETE'] as const;

export class CreateFormSubmissionDto {
  @IsString()
  @IsNotEmpty()
  clientId!: string;

  @IsString()
  @IsNotEmpty()
  formDefinitionId!: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsObject()
  responses!: Record<string, unknown>;

  @IsIn(COMPLETION_STATUSES)
  completionStatus!: (typeof COMPLETION_STATUSES)[number];
}
