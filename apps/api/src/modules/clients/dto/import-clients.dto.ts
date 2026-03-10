import {
  IsArray,
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Single row from CSV/Excel - maps to CreateClientDto fields.
 * Column names in file can vary; frontend/parser maps to these keys.
 */
export class ImportClientRowDto {
  @IsString()
  @MinLength(1, { message: 'Ad zorunludur' })
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MinLength(1, { message: 'Soyad zorunludur' })
  @MaxLength(100)
  lastName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Geçerli e-posta girin' })
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Geçerli tarih (YYYY-MM-DD) girin' })
  birthDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  gender?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  complaintAreas?: string[];
}

export class ImportClientsBodyDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportClientRowDto)
  rows!: ImportClientRowDto[];
}
