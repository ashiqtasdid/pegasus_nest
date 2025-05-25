import { Controller, Get, Res, Logger } from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';
import { existsSync } from 'fs';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  @Get('ui')
  serveUi(@Res() res: Response) {
    const filePath = join(process.cwd(), 'public', 'index.html');
    this.logger.log(`Attempting to serve UI from: ${filePath}`);

    if (!existsSync(filePath)) {
      this.logger.error(`File not found: ${filePath}`);
      return res
        .status(404)
        .send('UI file not found. Make sure public/index.html exists.');
    }

    return res.sendFile(filePath);
  }
}
