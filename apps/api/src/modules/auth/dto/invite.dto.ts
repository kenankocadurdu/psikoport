import { IsEmail, IsIn } from 'class-validator';

export class InviteDto {
  @IsEmail()
  email!: string;

  @IsIn(['assistant'])
  role!: 'assistant';
}
