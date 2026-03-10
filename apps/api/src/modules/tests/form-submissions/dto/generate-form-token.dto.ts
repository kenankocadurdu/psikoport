import { IsString, IsNotEmpty } from 'class-validator';

export class GenerateFormTokenDto {
  @IsString()
  @IsNotEmpty()
  clientId!: string;

  @IsString()
  @IsNotEmpty()
  formDefinitionId!: string;
}
