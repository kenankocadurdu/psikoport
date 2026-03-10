import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdatePaymentStatusDto {
  @IsIn(['PENDING', 'PAID', 'PARTIAL', 'CANCELLED'])
  status!: 'PENDING' | 'PAID' | 'PARTIAL' | 'CANCELLED';

  @IsOptional()
  @IsNumber()
  @Min(0)
  paidAmount?: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;
}
