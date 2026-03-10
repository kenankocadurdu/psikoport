import {
  IsDateString,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsEnum,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LocationTypeDto } from './create-appointment.dto';

export class UpdateAppointmentDto {
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  @Type(() => Number)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  sessionType?: string;

  @IsOptional()
  @IsEnum(LocationTypeDto)
  locationType?: LocationTypeDto;

  @IsOptional()
  @IsString()
  notes?: string;
}
