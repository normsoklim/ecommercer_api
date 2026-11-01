import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { BakongGateway } from './gateways/bakong.gateway';

export type PaymentStatus = 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'REFUNDED';
export type PaymentProvider = 'STRIPE' | 'BAKONG_KHQR';

@Injectable()
export class PaymentsService {
  constructor(
    private db: DatabaseService,
    private bakongGateway: BakongGateway,
  ) {}

  async createPayment(
    orderId: string,
    provider: PaymentProvider,
    amount: number,
    idempotencyKey?: string,
  ) {
    // Check idempotency
    if (idempotencyKey) {
      const existing = await this.db.query(
        'SELECT id FROM payments WHERE "idempotencyKey" = $1',
        [idempotencyKey],
      );
      if (existing.rows.length > 0) {
        return existing.rows[0];
      }
    }

    const order = await this.db.query(
      'SELECT id FROM orders WHERE id = $1',
      [orderId],
    );

    if (order.rows.length === 0) {
      throw new NotFoundException('Order not found');
    }

    const existingPayment = await this.db.query(
      'SELECT id FROM payments WHERE "orderId" = $1',
      [orderId],
    );

    if (existingPayment.rows.length > 0) {
      throw new ConflictException('Payment already exists for this order');
    }

    const result = await this.db.query(
      `INSERT INTO payments ("orderId", provider, status, amount, "idempotencyKey", "createdAt", "updatedAt")
       VALUES ($1, $2, 'PENDING', $3, $4, NOW(), NOW())
       RETURNING id, "orderId", provider, status, amount, "idempotencyKey", "createdAt", "updatedAt"`,
      [orderId, provider, amount, idempotencyKey],
    );

    return result.rows[0];
  }

  async findAll(page = 1, limit = 20, orderId?: string, status?: string) {
    const skip = (page - 1) * limit;
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (orderId) {
      conditions.push(`"orderId" = $${paramIndex++}`);
      values.push(orderId);
    }

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [paymentsResult, totalResult] = await this.db.transaction(async (client) => {
      const payments = await client.query(
        `SELECT p.*,
          o.id as order_id, o."orderNumber" as order_number, o."userId" as order_user_id, o."totalAmount" as order_total_amount
         FROM payments p
         LEFT JOIN orders o ON o.id = p."orderId"
         ${whereClause}
         ORDER BY p."createdAt" DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...values, limit, skip],
      );

      const total = await client.query(
        `SELECT COUNT(*) FROM payments p ${whereClause}`,
        values,
      );

      return [payments, total];
    });

    return {
      data: paymentsResult.rows,
      meta: {
        page,
        limit,
        total: parseInt(totalResult.rows[0].count, 10),
        totalPages: Math.ceil(parseInt(totalResult.rows[0].count, 10) / limit),
      },
    };
  }

  async findOne(id: string) {
    const result = await this.db.query(
      `SELECT p.*,
        o.id as order_id, o."orderNumber" as order_number, o."userId" as order_user_id, o."totalAmount" as order_total_amount
       FROM payments p
       LEFT JOIN orders o ON o.id = p."orderId"
       WHERE p.id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Payment not found');
    }

    return result.rows[0];
  }

  async updatePaymentStatus(
    paymentId: string,
    status: PaymentStatus,
    providerTransactionId?: string,
    rawResponse?: any,
  ) {
    const payment = await this.db.query(
      'SELECT id, "orderId", amount, "providerPaymentId" FROM payments WHERE id = $1',
      [paymentId],
    );

    if (payment.rows.length === 0) {
      throw new NotFoundException('Payment not found');
    }

    const paymentRow = payment.rows[0];

    const result = await this.db.query(
      `UPDATE payments SET status = $1, "providerPaymentId" = COALESCE($2, "providerPaymentId"), "updatedAt" = NOW() WHERE id = $3 RETURNING id, "orderId", provider, status, amount, "idempotencyKey", "createdAt", "updatedAt"`,
      [status, providerTransactionId, paymentId],
    );

    // Create transaction record
    await this.db.query(
      `INSERT INTO payment_transactions ("paymentId", type, amount, status, "providerTransactionId", "rawResponse", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        paymentId,
        status === 'CAPTURED' ? 'capture' : 'authorization',
        paymentRow.amount,
        status === 'CAPTURED' || status === 'AUTHORIZED' ? 'success' : 'failed',
        providerTransactionId,
        rawResponse ? JSON.stringify(rawResponse) : null,
      ],
    );

    // Update order status based on payment
    if (status === 'CAPTURED') {
      await this.db.query(
        `UPDATE orders SET status = 'CONFIRMED', "updatedAt" = NOW() WHERE id = $1`,
        [paymentRow.orderId],
      );
    }

    return result.rows[0];
  }

  async createRefund(paymentId: string, amount: number, reason?: string) {
    const payment = await this.db.query(
      'SELECT id, status FROM payments WHERE id = $1',
      [paymentId],
    );

    if (payment.rows.length === 0) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.rows[0].status !== 'CAPTURED') {
      throw new ConflictException('Can only refund captured payments');
    }

    const result = await this.db.query(
      `INSERT INTO refunds ("paymentId", amount, reason, status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'pending', NOW(), NOW())
       RETURNING id, "paymentId", amount, reason, status, "createdAt", "updatedAt"`,
      [paymentId, amount, reason],
    );

    return result.rows[0];
  }

  // KHQR-specific methods

  async createKhqrPayment(
    orderId: string,
    currency: string = 'USD',
    idempotencyKey?: string,
  ) {
    // Check idempotency
    if (idempotencyKey) {
      const existing = await this.db.query(
        'SELECT id FROM payments WHERE "idempotencyKey" = $1',
        [idempotencyKey],
      );
      if (existing.rows.length > 0) {
        return existing.rows[0];
      }
    }

    // Load order and validate
    const order = await this.db.query(
      `SELECT o.*, (SELECT json_agg(p) FROM payments p WHERE p."orderId" = o.id) as payments
       FROM orders o
       WHERE o.id = $1`,
      [orderId],
    );

    if (order.rows.length === 0) {
      throw new NotFoundException('Order not found');
    }

    const orderRow = order.rows[0];
    const payments = orderRow.payments || [];

    // Check if order already has a successful payment
    const successfulPayment = payments.find(
      (p: any) => p.status === 'CAPTURED' || p.status === 'AUTHORIZED',
    );
    if (successfulPayment) {
      throw new ConflictException('Order already has a successful payment');
    }

    // Check for existing pending KHQR payment
    const pendingKhqrPayment = payments.find(
      (p: any) =>
        p.provider === 'BAKONG_KHQR' &&
        (p.status === 'PENDING' || p.status === 'AUTHORIZED') &&
        p.currency === currency,
    );
    if (pendingKhqrPayment) {
      // Return existing payment if not expired and currency matches
      if (
        pendingKhqrPayment.expiresAt &&
        !this.bakongGateway.isPaymentExpired(pendingKhqrPayment.expiresAt)
      ) {
        return pendingKhqrPayment;
      }
      // Mark expired payment as failed
      await this.db.query(
        `UPDATE payments SET status = 'FAILED', "updatedAt" = NOW() WHERE id = $1`,
        [pendingKhqrPayment.id],
      );
    }

    // Calculate amount from order (server-side validation)
    const orderAmount = orderRow.totalAmount;
    const orderAmountInMajorUnits = orderAmount / 100; // Convert from minor units
    const orderCurrency = orderRow.currency || 'USD';

    // Convert amount if currencies differ
    let amountInMajorUnits = orderAmountInMajorUnits;
    let amountInMinorUnits = orderAmount;

    if (orderCurrency !== currency) {
      amountInMajorUnits = this.bakongGateway.convertCurrency(
        orderAmountInMajorUnits,
        orderCurrency,
        currency,
      );
      // USD is subdivided into cents, KHR is not subdivided (1 KHR = 1 minor unit).
      amountInMinorUnits =
        currency === 'USD' ? Math.round(amountInMajorUnits * 100) : Math.round(amountInMajorUnits);
    }

    // Generate KHQR data
    const khqrData = this.bakongGateway.generateKHQR(
      amountInMajorUnits,
      currency,
    );

    // Generate QR code image
    const qrCodeImage = await this.bakongGateway.generateQRCodeImage(
      khqrData.qrString,
    );

    // Calculate expiry time
    const expiresAt = this.bakongGateway.calculateExpiryTime();

    // Create payment record
    const payment = await this.db.query(
      `INSERT INTO payments ("orderId", provider, status, amount, currency, "idempotencyKey", "qrString", "transactionMd5", "expiresAt", "createdAt", "updatedAt")
       VALUES ($1, 'BAKONG_KHQR', 'PENDING', $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING id, "orderId", provider, status, amount, currency, "idempotencyKey", "qrString", "transactionMd5", "expiresAt", "createdAt", "updatedAt"`,
      [
        orderId,
        amountInMinorUnits,
        currency,
        idempotencyKey,
        khqrData.qrString,
        khqrData.md5,
        expiresAt,
      ],
    );

    // Return payment with QR code image
    return {
      ...payment.rows[0],
      qrCodeImage: `data:image/png;base64,${qrCodeImage}`,
      amountInMajorUnits,
      expiresAt,
      originalAmount: orderAmountInMajorUnits,
      originalCurrency: orderCurrency,
    };
  }

  async verifyKhqrPayment(paymentId: string, transactionHash?: string) {
    const result = await this.db.query(
      `SELECT p.*, o.id as order_id, o."orderNumber" as order_number
       FROM payments p
       LEFT JOIN orders o ON o.id = p."orderId"
       WHERE p.id = $1`,
      [paymentId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Payment not found');
    }

    const payment = result.rows[0];

    if (payment.provider !== 'BAKONG_KHQR') {
      throw new BadRequestException('Payment is not a KHQR payment');
    }

    // Check if payment is already captured
    if (payment.status === 'CAPTURED') {
      return {
        success: true,
        payment,
        message: 'Payment already verified',
      };
    }

    // Check if payment has expired
    if (
      payment.expiresAt &&
      this.bakongGateway.isPaymentExpired(payment.expiresAt)
    ) {
      await this.db.query(
        `UPDATE payments SET status = 'FAILED', "updatedAt" = NOW() WHERE id = $1`,
        [paymentId],
      );
      throw new BadRequestException('Payment has expired');
    }

    // Verify with Bakong API
    if (!payment.transactionMd5) {
      throw new BadRequestException('Payment does not have transaction MD5');
    }

    const verification = await this.bakongGateway.verifyPayment(
      payment.transactionMd5,
      transactionHash,
    );

    if (verification.success && verification.status === 'PAID') {
      // Update payment status to CAPTURED
      const updatedPayment = await this.updatePaymentStatus(
        paymentId,
        'CAPTURED',
        verification.transactionId,
        verification,
      );

      return {
        success: true,
        payment: updatedPayment,
        message: 'Payment verified successfully',
      };
    }

    return {
      success: false,
      payment,
      message: 'Payment not yet verified',
      verificationStatus: verification.status,
    };
  }

  async getKhqrPaymentStatus(paymentId: string) {
    const result = await this.db.query(
      `SELECT p.*, o.id as order_id
       FROM payments p
       LEFT JOIN orders o ON o.id = p."orderId"
       WHERE p.id = $1`,
      [paymentId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Payment not found');
    }

    const payment = result.rows[0];

    if (payment.provider !== 'BAKONG_KHQR') {
      throw new BadRequestException('Payment is not a KHQR payment');
    }

    // Regenerate QR code image from stored qrString so the frontend can display it
    let qrCodeImage: string | null = null;
    if (payment.qrString) {
      const base64Image = await this.bakongGateway.generateQRCodeImage(
        payment.qrString,
      );
      qrCodeImage = `data:image/png;base64,${base64Image}`;
    }

    // Check if payment has expired
    let isExpired = false;
    if (
      payment.expiresAt &&
      this.bakongGateway.isPaymentExpired(payment.expiresAt)
    ) {
      isExpired = true;
      if (payment.status === 'PENDING') {
        await this.db.query(
          `UPDATE payments SET status = 'FAILED', "updatedAt" = NOW() WHERE id = $1`,
          [paymentId],
        );
      }
    }

    return {
      payment: {
        ...payment,
        qrCodeImage,
      },
      isExpired,
      canVerify:
        payment.status === 'PENDING' &&
        !isExpired &&
        payment.expiresAt &&
        new Date() < payment.expiresAt,
    };
  }
}
