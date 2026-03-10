import { SetMetadata } from '@nestjs/common';

export const ASSISTANT_FORBIDDEN_KEY = 'assistantForbidden';

/**
 * Endpoints marked with this decorator are forbidden for assistant role.
 * Use on notes read, sensitive settings, etc.
 * psychologist: full access. assistant: no access.
 */
export const AssistantForbidden = () =>
  SetMetadata(ASSISTANT_FORBIDDEN_KEY, true);
