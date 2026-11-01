import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ example: 'customer@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '123456',
    description: 'One-time code received by email',
  })
  @IsString()
  @Length(4, 10)
  @Matches(/^[0-9]+$/, { message: 'code must contain digits only' })
  code: string;
}
