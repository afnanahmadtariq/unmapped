import { Controller, Get, Param, Query } from '@nestjs/common';
import { SignalsService } from './signals.service';

@Controller('signals')
export class SignalsController {
  constructor(private readonly signals: SignalsService) {}

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
