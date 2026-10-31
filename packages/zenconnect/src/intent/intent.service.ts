import { Injectable } from '@nestjs/common';
import { ActionType } from '../common/dto/task.dto';

export interface IntentResult {
  actionType: ActionType;
  payload: any;
  confidence: number;
}

@Injectable()
export class IntentService {
  async parseIntent(userInput: string): Promise<IntentResult> {
    const lowerInput = userInput.toLowerCase();

    if (lowerInput.includes('transfer') || lowerInput.includes('send')) {
      return {
        actionType: ActionType.TRANSFER_FILE,
        payload: {
          fileName: this.extractFileName(userInput),
        },
        confidence: 0.8,
      };
    }

    if (lowerInput.includes('find') || lowerInput.includes('search')) {
      return {
        actionType: ActionType.FIND_FILE,
        payload: {
          query: this.extractQuery(userInput),
        },
        confidence: 0.7,
      };
    }

    if (lowerInput.includes('open')) {
      return {
        actionType: ActionType.OPEN_FILE,
        payload: {
          fileName: this.extractFileName(userInput),
        },
        confidence: 0.75,
      };
    }

    if (lowerInput.includes('list')) {
      return {
        actionType: ActionType.LIST_FILES,
        payload: {
          path: this.extractPath(userInput),
        },
        confidence: 0.65,
      };
    }

    throw new Error('Unable to parse intent from user input');
  }

  private extractFileName(input: string): string {
    const match = input.match(/['"]([^'"]+)['"]/);
    return match ? match[1] : 'unknown.txt';
  }

  private extractQuery(input: string): string {
    const match = input.match(/(?:find|search)\s+(?:for\s+)?['"]?([^'"]+)['"]?/i);
    return match ? match[1].trim() : '';
  }

  private extractPath(input: string): string {
    const match = input.match(/in\s+['"]?([^'"]+)['"]?/i);
    return match ? match[1] : '/';
  }
}
