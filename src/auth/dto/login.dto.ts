import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'customer@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Str0ngPassword!' })
  @IsString()
  password: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'Keep the session alive for a long period ("Keep me signed in"). When omitted or false the short lived tokens are issued.',
  })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
