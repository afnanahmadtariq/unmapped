import { Body, Controller, Post } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailProfileDto } from './email.dto';

@Controller('notifications')
export class EmailController {
  constructor(private readonly email: EmailService) {}

  @Post('email-profile')
  send(@Body() body: EmailProfileDto) {
    return this.email.sendProfileLink(body);
  }
}
