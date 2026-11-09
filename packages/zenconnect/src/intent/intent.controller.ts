import { BadRequestException, Controller, Post, Body } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { IntentService } from './intent.service';

export class ParseIntentDto {
  @IsString()
  @IsNotEmpty()
  userInput: string;
}

@Controller('v1/intent')
export class IntentController {
  constructor(private readonly intentService: IntentService) {}

  @Post('parse')
  async parseIntent(@Body() dto: ParseIntentDto) {
    try {
      const result = await this.intentService.parseIntent(dto.userInput);
      return {
        success: true,
        ...result,
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to parse intent from user input';
      throw new BadRequestException(message);
    }
  }
}
