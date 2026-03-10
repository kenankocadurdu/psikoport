import { IsNotEmpty, IsString } from 'class-validator';

export class LoginCallbackDto {
  @IsNotEmpty()
  @IsString()
  auth0Token!: string;
}
