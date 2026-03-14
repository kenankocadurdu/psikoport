import {
  IsArray,
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

  @IsString()
  content!: string;
}
