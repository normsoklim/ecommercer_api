import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: (req: Request) => {
        // Prefer the Authorization header, fall back to the HTTP-only
        // access_token cookie so the frontend does not need to send
        // bearer tokens from JavaScript.
        const tokenFromHeader = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
        if (tokenFromHeader) {
          return tokenFromHeader;
        }
        return req?.cookies?.access_token ?? null;
      },
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: any) {
    return {
      sub: payload.sub,
      email: payload.email,
      roles: payload.roles,
    };
  }
}
