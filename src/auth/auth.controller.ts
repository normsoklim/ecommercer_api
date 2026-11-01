import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  Patch,
  HttpCode,
  HttpStatus,
  Res,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response, Request as ExpressRequest } from 'express';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiTooManyRequestsResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SendVerificationCodeDto } from './dto/send-verification-code.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import {
  AuthResponseDto,
  RegisterResponseDto,
  UserResponseDto,
} from '../common/dto/responses.dto';
import type { AuthenticatedUser } from '../common/types/authenticated-user';

@ApiTags('auth')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register a new customer account' })
  @ApiCreatedResponse({
    description:
      'The account has been created, a one-time code was sent to the email address',
    type: RegisterResponseDto,
  })
  @ApiConflictResponse({ description: 'The email address is already taken' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('email/verification-code')
  @ApiOperation({
    summary: 'Send an email verification code (OTP) to the account owner',
  })
  @ApiOkResponse({ description: 'Verification code sent' })
  @ApiNotFoundResponse({ description: 'No account exists for this email' })
  @ApiTooManyRequestsResponse({
    description: 'A code was requested too recently, try again later',
  })
  async sendVerificationCode(
    @Body() sendVerificationCodeDto: SendVerificationCodeDto,
  ) {
    return this.authService.sendVerificationCode(sendVerificationCodeDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('email/verify')
  @ApiOperation({ summary: 'Verify an email address with a one-time code' })
  @ApiOkResponse({ description: 'Email address verified' })
  @ApiBadRequestResponse({
    description: 'The code is incorrect, expired or has no remaining attempts',
  })
  @ApiNotFoundResponse({ description: 'No account exists for this email' })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(LocalAuthGuard)
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiOkResponse({
    description: 'Access and refresh tokens issued as HTTP-only cookies',
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(loginDto, req);

    const isProduction = process.env.NODE_ENV === 'production';

    // In production use the __Host- prefix which requires Secure, Path=/ and
    // no Domain attribute, locking the cookie to the exact host.
    const accessCookieName = isProduction ? '__Host-access_token' : 'access_token';
    const refreshCookieName = isProduction ? '__Host-refresh_token' : 'refresh_token';

    // Access token: short lived, available site-wide.
    res.cookie(accessCookieName, result.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: result.expiresInMs,
    });

    // Refresh token: long lived, scoped to the auth path so it is only sent
    // to the login, refresh and logout endpoints.
    res.cookie(refreshCookieName, result.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: result.refreshExpiresInMs ?? 7 * 24 * 60 * 60 * 1000,
    });

    // Never return the refresh token in the response body.
    res.set('Cache-Control', 'no-store');
    return {
      message: 'Login successful',
      user: result.user,
    };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Exchange a refresh token for a new access token' })
  @ApiOkResponse({ description: 'New access token issued as HTTP-only cookie' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired refresh token' })
  async refresh(
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const isProduction = process.env.NODE_ENV === 'production';

    // In production use the __Host- prefix which requires Secure, Path=/ and
    // no Domain attribute, locking the cookie to the exact host.
    const accessCookieName = isProduction ? '__Host-access_token' : 'access_token';
    const refreshCookieName = isProduction ? '__Host-refresh_token' : 'refresh_token';

    // Read the refresh token from whichever cookie name is in use.
    const refreshToken = req.cookies?.[refreshCookieName] ?? req.cookies?.refresh_token;

    if (!refreshToken) {
      throw new UnauthorizedException('Session expired');
    }

    const result = await this.authService.refreshToken(refreshToken);

    res.cookie(accessCookieName, result.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: result.expiresInMs,
    });

    res.cookie(refreshCookieName, result.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: result.refreshExpiresInMs ?? 7 * 24 * 60 * 60 * 1000,
    });

    res.set('Cache-Control', 'no-store');
    return { message: 'Session refreshed' };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Log out and revoke the current session' })
  @ApiOkResponse({ description: 'Session revoked' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async logout(
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const isProduction = process.env.NODE_ENV === 'production';

    // In production use the __Host- prefix which requires Secure, Path=/ and
    // no Domain attribute, locking the cookie to the exact host.
    const accessCookieName = isProduction ? '__Host-access_token' : 'access_token';
    const refreshCookieName = isProduction ? '__Host-refresh_token' : 'refresh_token';

    const refreshToken = req.cookies?.[refreshCookieName] ?? req.cookies?.refresh_token;

    if (refreshToken) {
      await this.authService.logoutByRefreshToken(refreshToken);
    }

    // Clear cookies using the same options they were set with so the browser
    // matches and removes them. secure must match the original setting.
    res.clearCookie(accessCookieName, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
    });
    res.clearCookie(refreshCookieName, {
      path: '/api/v1/auth',
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
    });

    res.set('Cache-Control', 'no-store');
    return { message: 'Logged out' };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get the profile of the authenticated user' })
  @ApiOkResponse({
    description: 'The authenticated user',
    type: UserResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async profile(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user.sub);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update the profile of the authenticated user' })
  @ApiOkResponse({
    description: 'The updated user profile',
    type: UserResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user.sub, updateProfileDto);
  }
}
