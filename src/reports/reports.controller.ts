import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { ListReportsDto, ReportGranularity } from './dto/list-reports.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get the business report of a period (ADMIN, STAFF)',
    description:
      'Aggregates the orders of the period: revenue, order counts, sales over time, order status breakdown, top products and top customers. Cancelled and refunded orders are excluded from the revenue.',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    type: String,
    example: '2026-09-01',
    description: 'First day of the reporting window (ISO 8601 date)',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    type: String,
    example: '2026-09-30',
    description: 'Last day of the reporting window (ISO 8601 date)',
  })
  @ApiQuery({
    name: 'granularity',
    required: false,
    enum: ReportGranularity,
    example: ReportGranularity.DAY,
    description: 'Bucket size of the sales over time series',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 10,
    description: 'How many rows the top products / top customers lists hold',
  })
  @ApiOkResponse({
    description: 'The aggregated report',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN or STAFF role' })
  getReport(@Query() query: ListReportsDto) {
    return this.reportsService.getReport(query);
  }
}
