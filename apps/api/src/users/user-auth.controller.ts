import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { UserAuthService, AuthenticatedUser } from './user-auth.service';
import { UserAuthGuard } from './user-auth.guard';
import { UsersService } from './users.service';
import { EnvService } from '../infra/config/env.service';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  displayName: z.string().min(1).max(120).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * End-user auth surface, parallel to (but completely independent of)
 * the single-admin `/auth/*` controller. Routes:
 *
 *   POST /auth/user/signup   — create account + session
 *   POST /auth/user/login    — verify credentials + session
 *   POST /auth/user/logout   — clear session cookie
 *   GET  /auth/user/me       — current user (404-ish via guard if anon)
 *   PATCH /auth/user/me      — change displayName
 *   GET  /auth/user/status   — feature flags for the web shell
 */
@Controller('auth/user')
export class UserAuthController {
  constructor(
    private readonly auth: UserAuthService,
    private readonly users: UsersService,
    private readonly env: EnvService,
  ) {}

  @Post('signup')
  async signup(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues.map((i) => i.message).join('; '),
      );
    }
    const { user, token } = await this.users.signup(parsed.data);
    res.cookie(this.auth.cookieName(), token, this.cookieOptions());
    return { ok: true, user };
  }

  @Post('login')
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues.map((i) => i.message).join('; '),
      );
    }
    const { user, token } = await this.users.login(
      parsed.data.email,
      parsed.data.password,
    );
    res.cookie(this.auth.cookieName(), token, this.cookieOptions());
    return { ok: true, user };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(this.auth.cookieName(), {
      ...this.cookieOptions(),
      maxAge: 0,
    });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(UserAuthGuard)
  async me(@Req() req: Request) {
    const session = (req as unknown as { user: AuthenticatedUser }).user;
    const user = await this.users.findById(session.userId);
    return { user };
  }

  @Get('status')
  status() {
    return {
      enabled: this.auth.isEnabled(),
      signupEnabled: this.auth.isSignupEnabled(),
    };
  }

  private cookieOptions() {
    const isProd = this.env.isProduction();
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: isProd,
      path: '/',
      maxAge: this.auth.cookieMaxAgeMs(),
    };
  }
}
