import * as readline from 'readline';
import chalk from 'chalk';

let rl: readline.Interface | null = null;

export function initReadline(): readline.Interface {
  if (!rl) {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }
  return rl;
}

export function closeReadline(): void {
  if (rl) {
    rl.close();
    rl = null;
  }
}

export function prompt(question: string): Promise<string> {
  const readlineInterface = initReadline();
  return new Promise((resolve) => {
    readlineInterface.question(chalk.cyan(question), (answer) => {
      resolve(answer.trim());
    });
  });
}

export function sanitizeLog(str: string): string {
  return str.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
}

export function log(message: string): void {
  console.log(chalk.blue('→'), sanitizeLog(message));
}

export function success(message: string): void {
  console.log(chalk.green('✓'), sanitizeLog(message));
}

export function error(message: string): void {
  console.log(chalk.red('✗'), sanitizeLog(message));
}

export function info(message: string): void {
  console.log(chalk.yellow('ℹ'), sanitizeLog(message));
}

export function section(title: string): void {
  console.log('\n' + chalk.bold.cyan('='.repeat(60)));
  console.log(chalk.bold.cyan(`  ${sanitizeLog(title)}`));
  console.log(chalk.bold.cyan('='.repeat(60)) + '\n');
}

export function showMenu(deviceName: string, commands: string[]): void {
  const color = deviceName === 'Device A' ? chalk.bold.yellow : chalk.bold.magenta;
  console.log('\n' + color('='.repeat(50)));
  console.log(color(`  ${deviceName} - Interactive CLI`));
  console.log(color('='.repeat(50)));
  console.log('\n' + chalk.bold('Available Commands:'));
  commands.forEach(cmd => console.log(`  ${cmd}`));
  console.log('');
}

export function sanitizeToken(token: string, visibleChars = 20): string {
  if (token.length <= visibleChars) {
    return token.substring(0, 3) + '***';
  }
  return token.substring(0, visibleChars) + '...';
}

export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function formatError(err: any): string {
  return err.response?.data?.message || err.message || 'Unknown error';
}
