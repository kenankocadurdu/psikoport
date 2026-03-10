import { IsNotEmpty, IsString } from 'class-validator';

export class InviteAcceptDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @IsNotEmpty()
  auth0Token!: string;
}
