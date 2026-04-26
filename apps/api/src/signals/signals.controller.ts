import { Controller, Get, Param, Query } from '@nestjs/common';
import { SignalsService } from './signals.service';
import { CompositeSignalService } from './computed/composite.service';

@Controller('signals')
export class SignalsController {
  constructor(
    private readonly signals: SignalsService,
    private readonly composite: CompositeSignalService,
  ) {}

  /**
   * GET /signals/composite/:country/:iscoCode?  – the full A-H bundle.
   * `declaredSkills` is optional and accepts a comma-separated list of
   * ISCO codes (used by `skillDurability` and `crossSkillTransferability`).
   */
  // path-to-regexp v8 (Nest 11) dropped the `?` optional suffix.
  // Express two routes onto the same handler instead.
  @Get(['composite/:country', 'composite/:country/:iscoCode'])
  getComposite(
    @Param('country') country: string,
    @Param('iscoCode') iscoCode?: string,
    @Query('skills') skills?: string,
  ) {
    const declared = skills
      ? skills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    return this.composite.compute(country, iscoCode ?? null, declared);
  }

  /** GET /signals/country/:code — wages, growth, calibration in one shot. */
  @Get('country/:code')
  countrySnapshot(@Param('code') code: string) {
    return this.signals.getCountrySnapshot(code);
  }

  /** GET /signals/risk/:iscoCode?country=GH — calibrated automation risk. */
  @Get('risk/:iscoCode')
  risk(@Param('iscoCode') iscoCode: string, @Query('country') country = 'GH') {
    return this.signals.calibrateRisk(iscoCode, country);
  }

  /** GET /signals/wage/GH/2512 */
  @Get('wage/:country/:iscoCode')
  async wage(
    @Param('country') country: string,
    @Param('iscoCode') iscoCode: string,
  ) {
    const amount = await this.signals.getWageFor(country, iscoCode);
    const currency = this.signals.getCurrencyFor(country);
    return { country, iscoCode, amount, currency };
  }
}
