import { IsArray, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateNoteMetaDto {
  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsArray()
  symptomCategories?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  moodRating?: number;
}
