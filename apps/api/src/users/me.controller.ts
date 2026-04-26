import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { AuthenticatedUser } from './user-auth.service';
import { UserAuthGuard } from './user-auth.guard';
import { UserProfilesService } from './user-profiles.service';

const upsertSchema = z.object({
  countryCode: z.string().min(2).max(4),
  extractInput: z.record(z.string(), z.unknown()),
  skillsProfile: z.record(z.string(), z.unknown()),
  matches: z.record(z.string(), z.unknown()).nullable().optional(),
  opportunities: z.record(z.string(), z.unknown()).nullable().optional(),
  signals: z.record(z.string(), z.unknown()).nullable().optional(),
  iscoCodes: z.array(z.string()).optional(),
});

/**
 * Personal-data endpoints. Every route is gated by `UserAuthGuard`, so
 * they 401 cleanly when the user is anonymous. The web layer uses these
 * to:
 *
 *   - Persist a wizard run                  → POST /me/profile
 *   - Hydrate the wizard on login           → GET  /me/profile/:cc
 *   - List saved profiles in /account       → GET  /me/profile
 *   - Drop a stale country profile          → DELETE /me/profile/:cc
 *   - Anonymised competition snapshot       → GET /me/profile/:cc/competition
 */
@Controller('me')
@UseGuards(UserAuthGuard)
export class MeController {
  constructor(private readonly profiles: UserProfilesService) {}

  @Get('profile')
  async list(@Req() req: Request) {
    const user = (req as unknown as { user: AuthenticatedUser }).user;
    const profiles = await this.profiles.list(user.userId);
    return { profiles };
  }

  @Get('profile/:countryCode')
  async getOne(
    @Req() req: Request,
    @Param('countryCode') countryCode: string,
  ) {
    const user = (req as unknown as { user: AuthenticatedUser }).user;
    const profile = await this.profiles.getOne(user.userId, countryCode);
    return { profile };
  }

  @Post('profile')
  async upsert(@Req() req: Request, @Body() body: unknown) {
    const user = (req as unknown as { user: AuthenticatedUser }).user;
    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues.map((i) => i.message).join('; '),
      );
    }
    const profile = await this.profiles.upsert(user.userId, parsed.data);
    return { profile };
  }

  @Delete('profile/:countryCode')
  async remove(
    @Req() req: Request,
    @Param('countryCode') countryCode: string,
  ) {
    const user = (req as unknown as { user: AuthenticatedUser }).user;
    return this.profiles.delete(user.userId, countryCode);
  }

  @Get('profile/:countryCode/competition')
  async competition(
    @Req() req: Request,
    @Param('countryCode') countryCode: string,
  ) {
    const user = (req as unknown as { user: AuthenticatedUser }).user;
    return this.profiles.competitionOverlap(user.userId, countryCode);
  }
}
