import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Injectable()
export class OrdersService {
  constructor(private db: DatabaseService) {}

  async findAll(page = 1, limit = 20, userId?: string, status?: string) {
    const skip = (page - 1) * limit;
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (userId) {
      conditions.push(`"userId" = $${paramIndex++}`);
      values.push(userId);
    }

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [ordersResult, totalResult] = await Promise.all([
      this.db.query(
        `SELECT o.*, 
          (SELECT json_agg(oi ORDER BY oi."createdAt" ASC) FROM order_items oi WHERE oi."orderId" = o.id) as items,
          (SELECT json_agg(p ORDER BY p."createdAt" ASC) FROM payments p WHERE p."orderId" = o.id) as payments,
          (SELECT json_agg(s ORDER BY s."createdAt" ASC) FROM shipments s WHERE s."orderId" = o.id) as shipments,
          (SELECT json_agg(a ORDER BY a."createdAt" ASC) FROM addresses a WHERE a."orderId" = o.id) as address,
          (SELECT json_build_object('id', u.id, 'email', u.email, 'firstName', u."firstName", 'lastName', u."lastName") FROM users u WHERE u.id = o."userId") as user
         FROM orders o
         ${whereClause}
         ORDER BY o."createdAt" DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...values, limit, skip],
      ),
      this.db.query(
        `SELECT COUNT(*) FROM orders o ${whereClause}`,
        values,
      ),
    ]);

    return {
      data: ordersResult.rows,
      meta: {
        page,
        limit,
        total: parseInt(totalResult.rows[0].count, 10),
        totalPages: Math.ceil(parseInt(totalResult.rows[0].count, 10) / limit),
      },
    };
  }

  async findOne(id: string, userId?: string) {
    const conditions: string[] = ['o.id = $1'];
    const values: unknown[] = [id];
    let paramIndex = 2;

    if (userId) {
      conditions.push(`o."userId" = $${paramIndex++}`);
      values.push(userId);
    }

    const result = await this.db.query(
      `SELECT o.*,
        (SELECT json_agg(oi ORDER BY oi."createdAt" ASC) FROM order_items oi WHERE oi."orderId" = o.id) as items,
        (SELECT json_agg(p ORDER BY p."createdAt" ASC) FROM payments p WHERE p."orderId" = o.id) as payments,
        (SELECT json_agg(s ORDER BY s."createdAt" ASC) FROM shipments s WHERE s."orderId" = o.id) as shipments,
        (SELECT json_agg(a ORDER BY a."createdAt" ASC) FROM addresses a WHERE a."orderId" = o.id) as address,
        (SELECT json_build_object('id', u.id, 'email', u.email, 'firstName', u."firstName", 'lastName', u."lastName") FROM users u WHERE u.id = o."userId") as user
       FROM orders o
       WHERE ${conditions.join(' AND ')}`,
      values,
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Order not found');
    }

    return result.rows[0];
  }

  async updateStatus(id: string, updateOrderStatusDto: UpdateOrderStatusDto) {
    const { status, trackingNumber, carrier } = updateOrderStatusDto;

    const order = await this.db.query(
      'SELECT id FROM orders WHERE id = $1',
      [id],
    );

    if (order.rows.length === 0) {
      throw new NotFoundException('Order not found');
    }

    const data: string[] = [`status = $1`];
    const values: unknown[] = [status];
    let paramIndex = 2;

    if (status === 'SHIPPED' && trackingNumber) {
      data.push(`"shippedAt" = $${paramIndex++}`);
      values.push(new Date());
    }

    if (status === 'DELIVERED') {
      data.push(`"deliveredAt" = $${paramIndex++}`);
      values.push(new Date());
    }

    data.push(`"updatedAt" = NOW()`);
    values.push(id);

    const updatedOrder = await this.db.query(
      `UPDATE orders SET ${data.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );

    // Create shipment if tracking info provided
    if (trackingNumber && carrier) {
      await this.db.query(
        `INSERT INTO shipments ("orderId", "trackingNumber", carrier, status, "shippedAt", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [
          id,
          trackingNumber,
          carrier,
          status === 'SHIPPED' ? 'IN_TRANSIT' : 'PENDING',
          status === 'SHIPPED' ? new Date() : null,
        ],
      );
    }

    return updatedOrder.rows[0];
  }

  async cancelOrder(id: string, userId: string) {
    const order = await this.db.query(
      `SELECT o.*,
        (SELECT json_agg(oi) FROM order_items oi WHERE oi."orderId" = o.id) as items,
        (SELECT json_agg(p) FROM payments p WHERE p."orderId" = o.id AND p.status = 'CAPTURED') as payments
       FROM orders o
       WHERE o.id = $1`,
      [id],
    );

    if (order.rows.length === 0) {
      throw new NotFoundException('Order not found');
    }

    const ord = order.rows[0];

    if (ord.userId !== userId) {
      throw new ConflictException('Not authorized to cancel this order');
    }

    if (!['PENDING', 'CONFIRMED'].includes(ord.status)) {
      throw new ConflictException('Cannot cancel order in current status');
    }

    // Release reserved stock
    for (const item of ord.items || []) {
      await this.db.query(
        `UPDATE inventory SET "reservedQuantity" = "reservedQuantity" - $1 WHERE "productId" = $2 AND ("variantId" = $3 OR ("variantId" IS NULL AND $3 IS NULL))`,
        [item.quantity, item.productId, item.variantId ?? null],
      );

      await this.db.query(
        `INSERT INTO inventory_movements ("inventoryId", type, quantity, "referenceId", "referenceType", notes, "createdAt")
         SELECT id, 'RELEASE', $1, $2, 'order', $3, NOW()
         FROM inventory WHERE "productId" = $4 AND ("variantId" = $5 OR ("variantId" IS NULL AND $5 IS NULL)) LIMIT 1`,
        [
          -item.quantity,
          id,
          `Stock released for cancelled order ${ord.orderNumber}`,
          item.productId,
          item.variantId ?? null,
        ],
      );
    }

    const result = await this.db.query(
      `UPDATE orders SET status = 'CANCELLED', "updatedAt" = NOW() WHERE id = $1 RETURNING *`,
      [id],
    );

    return result.rows[0];
  }
}
