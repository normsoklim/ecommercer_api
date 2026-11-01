import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

interface RequestWithAuth {
  headers?: Record<string, string | undefined>;
}

/**
 * Guard used by the endpoints that are public but behave differently for the
 * authenticated ADMIN / STAFF members.
 *
 * The request is never rejected: when a valid access token is present the user
 * is attached to the request, otherwise the endpoint keeps working anonymously.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const authorization = request?.headers?.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      return true;
    }

    return super.canActivate(context);
  }

  public handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser,
  ): TUser | null {
    // An invalid or expired token must not break a public endpoint: the
    // request simply stays anonymous.
    return user ?? null;
  }
}
