import { IsObject, IsIn } from 'class-validator';

const COMPLETION_STATUSES = ['DRAFT', 'COMPLETE'] as const;

/**
 * DTO for form submission via token (client fills form, no Auth0).
 * clientId, formDefinitionId, tenantId come from JWT.
 */
export class SubmitByTokenDto {
  @IsObject()
  responses!: Record<string, unknown>;

  @IsIn(COMPLETION_STATUSES)
  completionStatus!: (typeof COMPLETION_STATUSES)[number];
}
