import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { EventsService } from './app.service';

@Controller('api')
export class AppController {
  constructor(private readonly appService: EventsService) {}

  @Post('/:queueName')
  publishMessage(
    @Param('queueName') queueName: string,
    @Body() payload: Record<string, any>,
  ): Promise<Array<Record<string, any>>> {
    return this.appService.publishMessage(queueName, payload);
  }
  @Get('/:queueName')
  async subscribeToMessages(
    @Param('queueName') queueName: string,
    @Query('timeout', new DefaultValuePipe(10000)) timeout: number,
    @Res() res: Response,
  ): Promise<any> {
    try {
      const message = await this.appService.waitForMessage(queueName, timeout);
      if (message) {
        res.json({ message });
      } else {
        res.status(HttpStatus.NO_CONTENT).send();
      }
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(error.message);
    }
  }
}
