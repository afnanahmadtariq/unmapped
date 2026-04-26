import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { EnvService } from '../infra/config/env.service';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: 'user';
  iat?: number;
  exp?: number;
}

/**
 * Multi-user, opt-in auth — see `UserEntity` for the data shape.
 *
 * Mirrors `AuthService` (the single-admin implementation) deliberately:
 * same JWT-in-an-httpOnly-cookie pattern, same env-driven enable flag,
 * but distinct cookie name so admin + user sessions stay independent.
 *
 * The web layer treats this as fully optional: anonymous use of the
 * wizard / opportunities / dashboard keeps working when the feature is
 * disabled. The whole module is just a persistence-and-recall layer
 * sitting beside the existing endpoints.
 */
@Injectable()
export class UserAuthService {
  private readonly logger = new Logger(UserAuthService.name);
  private readonly secret: string | null;
  private readonly enabled: boolean;
  private readonly signupEnabled: boolean;
  private readonly ttlSeconds: number;

  constructor(private readonly env: EnvService) {
    this.secret = this.env.get('USER_JWT_SECRET') ?? null;
    this.enabled =
      this.env.get('USER_AUTH_ENABLED') && this.secret !== null;
    this.signupEnabled =
      this.enabled && this.env.get('USER_SIGNUP_ENABLED');
    this.ttlSeconds = this.env.get('USER_JWT_TTL_HOURS') * 3600;

    if (!this.enabled) {
      this.logger.warn(
        'User auth disabled: set USER_AUTH_ENABLED=true and USER_JWT_SECRET to enable.',
      );
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  isSignupEnabled(): boolean {
    return this.signupEnabled;
  }

  cookieName(): string {
    return 'unmapped_user_session';
  }

  cookieMaxAgeMs(): number {
    return this.ttlSeconds * 1000;
  }

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }

  async comparePassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  signToken(payload: { userId: string; email: string }): string {
    if (!this.secret) {
      throw new UnauthorizedException('User auth not configured');
    }
    const options: SignOptions = { expiresIn: this.ttlSeconds };
    return jwt.sign(
      { userId: payload.userId, email: payload.email, role: 'user' },
      this.secret as jwt.Secret,
      options,
    );
  }

  verify(token: string): AuthenticatedUser {
    if (!this.secret) {
      throw new UnauthorizedException('User auth disabled');
    }
    try {
      const payload = jwt.verify(token, this.secret) as AuthenticatedUser;
      if (payload.role !== 'user' || !payload.userId) {
        throw new UnauthorizedException('Token missing user role');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }
  }
}
