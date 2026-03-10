import {
  IsString,
  IsOptional,
  IsObject,
  IsInt,
  Min,
  IsBoolean,
  IsIn,
} from 'class-validator';

const FORM_TYPES = ['INTAKE', 'INTAKE_ADDON', 'PSYCHOMETRIC', 'CUSTOM'] as const;

export class UpdateFormDefinitionDto {
  @IsOptional()
  @IsString()
  @IsIn(FORM_TYPES)
  formType?: (typeof FORM_TYPES)[number];

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  targetAgeGroup?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedMinutes?: number;

  @IsOptional()
  @IsString()
  licenseStatus?: string;

  @IsOptional()
  @IsObject()
  schema?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  scoringConfig?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
