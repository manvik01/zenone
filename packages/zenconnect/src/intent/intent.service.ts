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

    if (lowerInput.includes('summarize') || lowerInput.includes('summary')) {
      return {
        actionType: ActionType.SUMMARIZE,
        payload: {
          content: this.extractContent(userInput),
        },
        confidence: 0.7,
      };
    }

    if (lowerInput.includes('list') && lowerInput.includes('device')) {
      return {
        actionType: ActionType.LIST_DEVICES,
        payload: {},
        confidence: 0.65,
      };
    }

    if (lowerInput.includes('status') || lowerInput.includes('state')) {
      return {
        actionType: ActionType.TASK_STATUS,
        payload: {
          taskId: this.extractTaskId(userInput),
        },
        confidence: 0.75,
      };
    }

    throw new Error('Unable to parse intent from user input');
  }

  private extractFileName(input: string): string {
    const match = input.match(/['"]([^'"]+)['"]/);
    return match ? match[1] : 'unknown.txt';
  }

  private extractContent(input: string): string {
    const match = input.match(/(?:summarize|summary)\s+(?:of\s+)?['"]?([^'"]+)['"]?/i);
    return match ? match[1].trim() : '';
  }

  private extractTaskId(input: string): string {
    const match = input.match(/(?:task|status)\s+['"]?([a-f0-9-]+)['"]?/i);
    return match ? match[1] : '';
  }
}
