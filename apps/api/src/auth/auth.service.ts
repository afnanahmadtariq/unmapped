import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { EnvService } from '../infra/config/env.service';

export interface AuthenticatedAdmin {
  email: string;
  role: 'admin';
  iat?: number;
  exp?: number;
}

/**
 * Single-admin auth backed by env vars (per the hackathon-grade plan).
 *
 * Two ways to configure the password (use one):
 *   - `ADMIN_PASSWORD_HASH` (bcrypt, recommended)
 *   - `ADMIN_PASSWORD` (plaintext, dev only — auto-hashed in memory at boot).
 *
 * Sessions are short-lived JWTs delivered as an httpOnly cookie. The
 * Next.js proxy reads the cookie and redirects unauthenticated `/admin/*`
 * traffic to `/admin/login`.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly email: string | null;
  private readonly secret: string | null;
  private readonly ttlSeconds: number;
  private hashPromise: Promise<string | null> | null = null;

  constructor(private readonly env: EnvService) {
    this.email = this.env.get('ADMIN_EMAIL') ?? null;
    this.secret = this.env.get('ADMIN_JWT_SECRET') ?? null;
    this.ttlSeconds = this.env.get('ADMIN_JWT_TTL_HOURS') * 3600;
    if (!this.email || !this.secret) {
      this.logger.warn(
        'Admin auth disabled: set ADMIN_EMAIL + ADMIN_JWT_SECRET (+ ADMIN_PASSWORD or ADMIN_PASSWORD_HASH) to enable.',
      );
    }
  }

  isEnabled(): boolean {
    return Boolean(this.email && this.secret);
  }

  cookieName(): string {
    return 'unmapped_admin_session';
  }

  cookieMaxAgeMs(): number {
    return this.ttlSeconds * 1000;
  }

  /**
   * Verifies email + password, returns a signed JWT on success.
   * Compares bcrypt against `ADMIN_PASSWORD_HASH` (preferred) or hashes
   * `ADMIN_PASSWORD` once at boot for dev convenience.
   */
  async login(email: string, password: string): Promise<string> {
    if (!this.isEnabled()) {
      throw new UnauthorizedException('Admin auth not configured');
    }
    if (email.trim().toLowerCase() !== this.email!.toLowerCase()) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const hash = await this.getHash();
    if (!hash) {
      throw new UnauthorizedException(
        'Admin password not configured (set ADMIN_PASSWORD or ADMIN_PASSWORD_HASH)',
      );
    }
    const ok = await bcrypt.compare(password, hash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return this.signToken(email);
  }

  /** Verify a JWT and return the admin payload, or throw 401. */
  verify(token: string): AuthenticatedAdmin {
    if (!this.secret) throw new UnauthorizedException('Auth disabled');
    try {
      const payload = jwt.verify(token, this.secret) as AuthenticatedAdmin;
      if (payload.role !== 'admin') {
        throw new UnauthorizedException('Token missing admin role');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private signToken(email: string): string {
    const options: SignOptions = { expiresIn: this.ttlSeconds };
    return jwt.sign({ email, role: 'admin' }, this.secret as jwt.Secret, options);
  }

  private async getHash(): Promise<string | null> {
    if (this.hashPromise) return this.hashPromise;
    const explicit = this.env.get('ADMIN_PASSWORD_HASH');
    if (explicit && explicit.trim().length > 0) {
      this.hashPromise = Promise.resolve(explicit);
      return this.hashPromise;
    }
    const plain = this.env.get('ADMIN_PASSWORD');
    if (!plain || plain.trim().length === 0) {
      this.hashPromise = Promise.resolve(null);
      return this.hashPromise;
    }
    this.hashPromise = bcrypt.hash(plain, 10);
    return this.hashPromise;
  }
}
