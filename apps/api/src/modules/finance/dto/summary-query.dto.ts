import { IsIn, IsOptional } from 'class-validator';

export class SummaryQueryDto {
  @IsOptional()
  @IsIn(['weekly', 'monthly'])
  period?: 'weekly' | 'monthly' = 'monthly';
}
