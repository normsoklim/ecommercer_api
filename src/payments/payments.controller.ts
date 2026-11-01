import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { CreateKhqrPaymentDto } from './dto/create-khqr-payment.dto';
import { VerifyKhqrPaymentDto } from './dto/verify-khqr-payment.dto';
import { paginatedResponseSchema } from '../common/dto/pagination.dto';

@ApiTags('payments')
@ApiBearerAuth('access-token')
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post('create')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a payment for an order' })
  @ApiCreatedResponse({
    description: 'The created payment',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  createPayment(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentsService.createPayment(
      createPaymentDto.orderId,
      createPaymentDto.provider,
      createPaymentDto.amount,
      createPaymentDto.idempotencyKey,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'List payments (ADMIN, STAFF)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'orderId', required: false, type: String })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    example: 'PENDING',
  })
  @ApiOkResponse({
    description: 'Paginated list of payments',
    schema: paginatedResponseSchema({
      type: 'object',
      additionalProperties: true,
    }),
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN or STAFF role' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('orderId') orderId?: string,
    @Query('status') status?: string,
  ) {
    return this.paymentsService.findAll(
      parseInt(page ?? '1', 10),
      parseInt(limit ?? '20', 10),
      orderId,
      status,
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get a payment by id' })
  @ApiParam({ name: 'id', description: 'Payment id (UUID)' })
  @ApiOkResponse({
    description: 'The payment',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiNotFoundResponse({ description: 'Payment not found' })
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  @Post(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Update the status of a payment (ADMIN, STAFF)' })
  @ApiParam({ name: 'id', description: 'Payment id (UUID)' })
  @ApiCreatedResponse({
    description: 'The updated payment',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN or STAFF role' })
  @ApiNotFoundResponse({ description: 'Payment not found' })
  updatePaymentStatus(
    @Param('id') id: string,
    @Body() updatePaymentStatusDto: UpdatePaymentStatusDto,
  ) {
    return this.paymentsService.updatePaymentStatus(
      id,
      updatePaymentStatusDto.status,
      updatePaymentStatusDto.providerTransactionId,
      updatePaymentStatusDto.rawResponse,
    );
  }

  @Post('refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Refund a payment (ADMIN, STAFF)' })
  @ApiCreatedResponse({
    description: 'The created refund',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN or STAFF role' })
  @ApiNotFoundResponse({ description: 'Payment not found' })
  createRefund(@Body() createRefundDto: CreateRefundDto) {
    return this.paymentsService.createRefund(
      createRefundDto.paymentId,
      createRefundDto.amount,
      createRefundDto.reason,
    );
  }

  // KHQR-specific endpoints

  @Post('khqr')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a KHQR payment for an order' })
  @ApiCreatedResponse({
    description: 'The created KHQR payment with QR code',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiBadRequestResponse({
    description: 'Invalid request or order already paid',
  })
  createKhqrPayment(@Body() createKhqrPaymentDto: CreateKhqrPaymentDto) {
    return this.paymentsService.createKhqrPayment(
      createKhqrPaymentDto.orderId,
      createKhqrPaymentDto.currency,
      createKhqrPaymentDto.idempotencyKey,
    );
  }

  @Post(':id/verify-khqr')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Verify a KHQR payment with Bakong API' })
  @ApiParam({ name: 'id', description: 'Payment id (UUID)' })
  @ApiCreatedResponse({
    description: 'Payment verification result',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiNotFoundResponse({ description: 'Payment not found' })
  @ApiBadRequestResponse({ description: 'Payment expired or invalid' })
  verifyKhqrPayment(
    @Param('id') id: string,
    @Body() verifyKhqrPaymentDto: VerifyKhqrPaymentDto,
  ) {
    return this.paymentsService.verifyKhqrPayment(
      id,
      verifyKhqrPaymentDto.transactionHash,
    );
  }

  @Get(':id/khqr-status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get KHQR payment status' })
  @ApiParam({ name: 'id', description: 'Payment id (UUID)' })
  @ApiOkResponse({
    description: 'Payment status with expiry information',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiNotFoundResponse({ description: 'Payment not found' })
  @ApiBadRequestResponse({ description: 'Payment is not a KHQR payment' })
  getKhqrPaymentStatus(@Param('id') id: string) {
    return this.paymentsService.getKhqrPaymentStatus(id);
  }
}
