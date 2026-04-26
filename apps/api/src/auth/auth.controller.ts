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
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { EnvService } from '../infra/config/env.service';

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Auth endpoints — login sets an httpOnly cookie, logout clears it,
 * `me` lets the admin UI confirm the active session before rendering
 * sensitive pages.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly env: EnvService,
  ) {}

  @Post('login')
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const parsed = loginBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message).join('; '));
    }
    const token = await this.auth.login(parsed.data.email, parsed.data.password);
    res.cookie(this.auth.cookieName(), token, this.cookieOptions());
    return { ok: true, email: parsed.data.email };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(this.auth.cookieName(), { ...this.cookieOptions(), maxAge: 0 });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() req: Request) {
    return { admin: (req as any).admin };
  }

  @Get('status')
  status() {
    return { enabled: this.auth.isEnabled() };
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
