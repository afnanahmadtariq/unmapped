import { Body, Controller, Post } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { FindJobsDto } from './jobs.dto';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Post('search')
  async search(@Body() body: FindJobsDto) {
    const jobs = await this.jobs.search(body.title, body.countryCode);
    return { jobs };
  }
}
