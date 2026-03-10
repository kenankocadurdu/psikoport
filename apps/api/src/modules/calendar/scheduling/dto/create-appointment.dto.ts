import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum LocationTypeDto {
  IN_PERSON = 'IN_PERSON',
  ONLINE = 'ONLINE',
}

export class CreateAppointmentDto {
  @IsString()
  @IsNotEmpty()
  clientId!: string;

  @IsString()
  @IsNotEmpty()
  psychologistId!: string;

  @IsDateString()
  startTime!: string;

  @IsDateString()
  endTime!: string;

  @IsInt()
  @Min(5)
  @Max(480)
  @Type(() => Number)
  durationMinutes!: number;

  @IsOptional()
  @IsString()
  sessionType?: string;

  @IsOptional()
  @IsEnum(LocationTypeDto)
  locationType?: LocationTypeDto;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  recurrenceRule?: Record<string, unknown>;
}
