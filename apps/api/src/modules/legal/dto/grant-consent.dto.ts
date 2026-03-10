import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export const CONSENT_TYPES = [
  'KVKK_DATA_PROCESSING',
  'KVKK_SPECIAL_DATA',
  'SESSION_RECORDING',
  'ONLINE_CONSULTATION',
  'CANCELLATION_POLICY',
  'PLATFORM_TOS',
] as const;

export type ConsentTypeDto = (typeof CONSENT_TYPES)[number];

export class GrantConsentDto {
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsEnum(CONSENT_TYPES)
  consentType!: ConsentTypeDto;

  @IsInt()
  @Min(1)
  textVersion!: number;

  @IsString()
  bodyHash!: string;

  @IsOptional()
  @IsString()
  userId?: string;
}
