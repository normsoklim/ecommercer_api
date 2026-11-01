import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { VerificationService } from './verification.service';
import { PasswordService } from './password.service';
import { DatabaseModule } from '../database/database.module';
import { MailModule } from '../mail/mail.module';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    DatabaseModule,
    MailModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_ACCESS_EXPIRATION', '15m'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, VerificationService, PasswordService, JwtStrategy, LocalStrategy],
  exports: [AuthService, VerificationService, PasswordService],
})
export class AuthModule {}
