import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Health check' })
  @ApiOkResponse({
    description: 'The service is up',
    schema: { type: 'object', additionalProperties: true },
  })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check with service metadata' })
  @ApiOkResponse({
    description: 'The service is up',
    schema: { type: 'object', additionalProperties: true },
  })
  health(): Record<string, unknown> {
    return this.appService.getHealth();
  }

  @Get('health/db')
  @ApiOperation({ summary: 'Health check with database connectivity' })
  @ApiOkResponse({
    description: 'Database connectivity status',
    schema: { type: 'object', additionalProperties: true },
  })
  healthDb(): Promise<Record<string, unknown>> {
    return this.appService.getDatabaseHealth();
  }
}
