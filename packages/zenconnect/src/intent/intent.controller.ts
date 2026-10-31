import { Controller, Post, Body } from '@nestjs/common';
import { IntentService } from './intent.service';

@Controller('v1/intent')
export class IntentController {
  constructor(private readonly intentService: IntentService) {}

  @Post('parse')
  async parseIntent(@Body() body: { userInput: string }) {
    const result = await this.intentService.parseIntent(body.userInput);
    return {
      success: true,
      ...result,
    };
  }
}
