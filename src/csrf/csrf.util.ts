import { doubleCsrf } from 'csrf-csrf';
import type { Request, Response, NextFunction } from 'express';

let csrfInstance: ReturnType<typeof doubleCsrf> | null = null;

/**
 * Lazily creates the doubleCsrf instance so that CSRF_SECRET is read at
 * runtime (after NestJS ConfigModule has loaded .env files) rather than at
 * module import time.
 */
function getCsrfInstance() {
  if (!csrfInstance) {
    const secret = process.env.CSRF_SECRET;
    if (!secret) {
      throw new Error('CSRF_SECRET is required');
    }
    csrfInstance = doubleCsrf({
      getSecret: () => secret,

      // Bind the CSRF token to the authenticated session. The access_token
      // cookie is unique per session, so unauthenticated users fall back to
      // their IP address.
      getSessionIdentifier: (req: Request) =>
        req.cookies?.['access_token'] ?? req.ip ?? 'anonymous',

      cookieName: 'csrf-token',

      cookieOptions: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      },

      // The frontend sends the token in the X-CSRF-Token header.
      getCsrfTokenFromRequest: (req: Request) =>
        req.headers['x-csrf-token'] as string,
    });
  }
  return csrfInstance;
}

/**
 * Express middleware that validates the CSRF token on state-changing requests
 * (POST, PUT, PATCH, DELETE). GET, HEAD and OPTIONS requests pass through.
 */
export function doubleCsrfProtection(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  return getCsrfInstance().doubleCsrfProtection(req, res, next);
}

/**
 * Generates a CSRF token, sets the csrf-token HttpOnly cookie, and returns
 * the token string so the frontend can read it and send it back in the
 * X-CSRF-Token header.
 */
export function generateCsrfToken(req: Request, res: Response): string {
  return getCsrfInstance().generateCsrfToken(req, res);
}
