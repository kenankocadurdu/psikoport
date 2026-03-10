import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsInt,
  Min,
  IsBoolean,
  IsIn,
} from 'class-validator';

const FORM_TYPES = ['INTAKE', 'INTAKE_ADDON', 'PSYCHOMETRIC', 'CUSTOM'] as const;

export class CreateFormDefinitionDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(FORM_TYPES)
  formType!: (typeof FORM_TYPES)[number];

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

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

  @IsObject()
  schema!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  scoringConfig?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
