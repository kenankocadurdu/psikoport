import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdatePaymentSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultSessionFee?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reminderDays?: number;
}
