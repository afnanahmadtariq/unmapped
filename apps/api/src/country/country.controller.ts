import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { CountryService } from './country.service';

@Controller('countries')
export class CountryController {
  constructor(private readonly countries: CountryService) {}

  /** GET /countries — full registry. ?byRegion=true returns grouped form. */
  @Get()
  list(@Query('byRegion') byRegion?: string) {
    if (byRegion === 'true') return this.countries.listByRegion();
    return this.countries.list();
  }

  /** GET /countries/:code — single country (ISO 3166-1 alpha-2). */
  @Get(':code')
  one(@Param('code') code: string) {
    const country = this.countries.find(code);
    if (!country) throw new NotFoundException(`Unknown country: ${code}`);
    return country;
  }
}
