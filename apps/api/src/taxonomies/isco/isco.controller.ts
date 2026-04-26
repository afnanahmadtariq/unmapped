import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { IscoService } from './isco.service';

@Controller('taxonomies/isco')
export class IscoController {
  constructor(private readonly isco: IscoService) {}

  @Get()
  list() {
    return this.isco.findAll();
  }

  @Get(':code')
  async one(@Param('code') code: string) {
    const occ = await this.isco.findByCode(code);
    if (!occ) throw new NotFoundException(`Unknown ISCO code: ${code}`);
    return occ;
  }
}
