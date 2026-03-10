import { IsObject, IsIn, IsString, IsNotEmpty, IsOptional } from 'class-validator';

const COMPLETION_STATUSES = ['DRAFT', 'COMPLETE'] as const;

/**
 * Body for POST /forms/public/submit.
 * Token can be in body (for client POST) or X-Form-Token header.
 */
export class SubmitByTokenBodyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  token?: string;

  @IsObject()
  responses!: Record<string, unknown>;

  @IsIn(COMPLETION_STATUSES)
  completionStatus!: (typeof COMPLETION_STATUSES)[number];
}
