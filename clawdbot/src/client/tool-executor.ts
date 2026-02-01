import { chromium } from 'playwright';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../common/logger';

const execAsync = promisify(exec);

export class ToolExecutor {
  async execute(tool: string, input: any): Promise<any> {
    switch (tool) {
      case 'browser':
        return this.executeBrowser(input);
      case 'http':
        return this.executeHttp(input);
      case 'command':
        return this.executeCommand(input);
      case 'python':
        return this.executePython(input);
      default:
        throw new Error(`Unknown tool: ${tool}`);
    }
  }

  private async executeBrowser(input: any) {
    logger.info(`Browser tool: ${input.action} on ${input.url}`);
    const browser = await chromium.launch();
    const page = await browser.newPage();

    try {
      await page.goto(input.url, { timeout: 30000 });

      if (input.action === 'screenshot') {
        const screenshot = await page.screenshot();
        return { screenshot: screenshot.toString('base64') };
      }

      if (input.action === 'extract') {
        const content = await page.content();
        return { content };
      }

      if (input.action === 'click') {
        await page.click(input.selector);
        return { success: true };
      }

      if (input.action === 'type') {
        await page.fill(input.selector, input.text);
        return { success: true };
      }

      throw new Error(`Unknown browser action: ${input.action}`);
    } finally {
      await browser.close();
    }
  }

  private async executeHttp(input: any) {
    logger.info(`HTTP tool: ${input.method || 'GET'} ${input.url}`);
    const response = await axios({
      method: input.method || 'GET',
      url: input.url,
      headers: input.headers,
      data: input.data,
      timeout: 30000,
    });

    return {
      status: response.status,
      headers: response.headers,
      data: response.data,
    };
  }

  private async executeCommand(input: any) {
    logger.info(`Command tool: ${input.command}`);
    const { stdout, stderr } = await execAsync(input.command, {
      timeout: 60000,
    });
    return { stdout, stderr };
  }

  private async executePython(input: any) {
    logger.info(`Python tool: executing code`);
    const { stdout, stderr } = await execAsync(`python -c "${input.code}"`, {
      timeout: 60000,
    });
    return { stdout, stderr };
  }

  getAvailableTools(): string[] {
    return ['browser', 'http', 'command', 'python'];
  }
}
