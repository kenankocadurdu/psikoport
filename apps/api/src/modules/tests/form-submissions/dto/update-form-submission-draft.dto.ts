import { IsObject } from 'class-validator';

export class UpdateFormSubmissionDraftDto {
  @IsObject()
  responses!: Record<string, unknown>;
}
