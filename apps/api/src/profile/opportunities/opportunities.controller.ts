import { Body, Controller, Post } from '@nestjs/common';
import { OpportunitiesService } from './opportunities.service';
import { OpportunityPathwaysDto } from './opportunities.dto';

@Controller('profile/opportunities')
export class OpportunitiesController {
  constructor(private readonly opportunities: OpportunitiesService) {}

  @Post()
  async run(@Body() body: OpportunityPathwaysDto) {
    const opportunities = await this.opportunities.generate(body);
    return { opportunities };
  }
}
