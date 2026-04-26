import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserAuthService, AuthenticatedUser } from './user-auth.service';

/**
 * Guard for end-user `/me/*` routes. Reads the JWT from the
 * `cartographer_user_session` cookie (default browser flow) or an
 * `Authorization: Bearer ...` header (curl / programmatic flow).
 *
 * Distinct from `AuthGuard` (which gates the single-admin `/admin/*`
 * routes) so the two roles can never authenticate against each other.
 */
@Injectable()
export class UserAuthGuard implements CanActivate {
  constructor(private readonly auth: UserAuthService) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.auth.isEnabled()) {
      throw new UnauthorizedException('User auth disabled');
    }
    const req = context.switchToHttp().getRequest();
    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException('Missing user session');
    const payload = this.auth.verify(token);
    (req as unknown as { user: AuthenticatedUser }).user = payload;
    return true;
  }

  private extractToken(req: any): string | null {
    const cookieToken = req?.cookies?.[this.auth.cookieName()];
    if (typeof cookieToken === 'string' && cookieToken.length > 0) {
      return cookieToken;
    }
    const header = req?.headers?.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice('Bearer '.length).trim();
    }
    return null;
  }
}
