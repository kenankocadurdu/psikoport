import { IsOptional, IsString, IsArray, IsNumber, Min } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specializations?: string[];

  @IsOptional()
  education?: Array<{ school: string; degree?: string; year?: string }>;

  @IsOptional()
  experience?: Array<{ title: string; organization?: string; years?: string }>;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sessionTypes?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  sessionFee?: number;

  @IsOptional()
  @IsString()
  officeAddress?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @IsOptional()
  @IsString()
  seoTitle?: string;

  @IsOptional()
  @IsString()
  seoDescription?: string;

  @IsOptional()
  @IsString()
  seoKeywords?: string;
}
