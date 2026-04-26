import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

/**
 * Guard that gates every `/admin/*` route. It accepts the JWT as either
 * an httpOnly cookie (default, browser flow) or `Authorization: Bearer ...`
 * (curl / programmatic flow). Disables itself gracefully when admin auth
 * is not configured — useful for local boot where the dev hasn't set
 * ADMIN_EMAIL yet.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.auth.isEnabled()) {
      throw new UnauthorizedException(
        'Admin auth disabled (set ADMIN_EMAIL + ADMIN_JWT_SECRET in env)',
      );
    }
    const req = context.switchToHttp().getRequest();
    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException('Missing admin session');
    const payload = this.auth.verify(token);
    req.admin = payload;
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
