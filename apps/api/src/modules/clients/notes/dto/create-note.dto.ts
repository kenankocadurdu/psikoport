import {
  IsArray,
  IsBase64,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateNoteDto {
  @IsDateString()
  sessionDate!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  sessionNumber?: number;

  @IsOptional()
  @IsString()
  sessionType?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symptomCategories?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  moodRating?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(480)
  durationMinutes?: number;

  @IsBase64()
  encryptedContent!: string;

  @IsBase64()
  encryptedDek!: string;

  @IsBase64()
  contentNonce!: string;

  @IsBase64()
  contentAuthTag!: string;

  @IsBase64()
  dekNonce!: string;

  @IsBase64()
  dekAuthTag!: string;
}
