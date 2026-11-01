/**
 * Shape of the JWT payload attached to the request by the auth guards.
 */
export interface AuthenticatedUser {
  /** User id (the `sub` claim of the access token). */
  sub: string;
  email?: string;
  roles?: string[];
}
