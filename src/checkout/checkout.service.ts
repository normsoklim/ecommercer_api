import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CartService } from '../cart/cart.service';
import { InventoryService } from '../inventory/inventory.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

@Injectable()
export class CheckoutService {
  constructor(
    private db: DatabaseService,
    private cartService: CartService,
    private inventoryService: InventoryService,
  ) {}

  async createCheckout(userId: string, createCheckoutDto: CreateCheckoutDto) {
    const { idempotencyKey, shippingAddress, couponCode } = createCheckoutDto;

    // Check idempotency
    if (idempotencyKey) {
      const existingOrder = await this.db.query(
        'SELECT id FROM orders WHERE "idempotencyKey" = $1',
        [idempotencyKey],
      );
      if (existingOrder.rows.length > 0) {
        return existingOrder.rows[0];
      }
    }

    // Get cart with product and variant details joined in
    const cart = await this.db.query(
      `SELECT c.*,
        (SELECT COALESCE(json_agg(
          json_build_object(
            'id', ci.id,
            'cartId', ci."cartId",
            'productId', ci."productId",
            'variantId', ci."variantId",
            'quantity', ci.quantity,
            'unitPrice', ci."unitPrice",
            'createdAt', ci."createdAt",
            'product', json_build_object(
              'id', p.id,
              'name', p.name,
              'slug', p.slug,
              'sku', p.sku,
              'basePrice', p."basePrice"
            ),
            'variant', CASE
              WHEN ci."variantId" IS NOT NULL THEN json_build_object(
                'id', v.id,
                'name', v.name,
                'priceAdjustment', v."priceAdjustment"
              )
              ELSE NULL
            END
          ) ORDER BY ci."createdAt" ASC
        ), '[]'::json) FROM cart_items ci
         JOIN products p ON p.id = ci."productId"
         LEFT JOIN product_variants v ON v.id = ci."variantId"
         WHERE ci."cartId" = c.id) as items
       FROM carts c
       WHERE c."userId" = $1`,
      [userId],
    );

    if (cart.rows.length === 0 || cart.rows[0].items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const cartRow = cart.rows[0];
    const cartItems = cartRow.items;

    // Validate stock and calculate totals
    let subtotal = 0;
    const orderItems: any[] = [];
    // The inventory rows that are reserved for this order.
    const reservations: {
      inventoryId: string;
      productId: string;
      variantId: string | null;
      quantity: number;
    }[] = [];

    for (const item of cartItems) {
      const product = item.product;
      const variant = item.variant;

      // Check inventory
      const inventory = await this.db.query(
        `SELECT * FROM inventory WHERE "productId" = $1 AND ("variantId" = $2 OR ("variantId" IS NULL AND $2 IS NULL)) LIMIT 1`,
        [product.id, variant?.id ?? null],
      );

      if (inventory.rows.length === 0) {
        throw new ConflictException(`No inventory for product ${product.name}`);
      }

      const inv = inventory.rows[0];
      const availableStock = inv.quantity - inv.reservedQuantity;
      if (availableStock < item.quantity) {
        throw new ConflictException(
          `Insufficient stock for ${product.name}. Available: ${availableStock}, Requested: ${item.quantity}`,
        );
      }

      const unitPrice = item.unitPrice;
      const totalPrice = unitPrice * item.quantity;
      subtotal += totalPrice;

      orderItems.push({
        productId: product.id,
        variantId: variant?.id ?? null,
        productName: product.name,
        productSku: product.sku,
        variantName: variant?.name ?? null,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
      });

      reservations.push({
        inventoryId: inv.id,
        productId: product.id,
        variantId: variant?.id ?? null,
        quantity: item.quantity,
      });
    }

    // Calculate totals
    const taxAmount = Math.round(subtotal * 0.1); // 10% tax
    const shippingAmount = 0; // Free shipping for now
    const discountAmount = 0; // Coupon logic would go here
    const totalAmount = subtotal + taxAmount + shippingAmount - discountAmount;

    // Create order in a transaction
    const order = await this.db.transaction(async (client) => {
      // Create order
      const newOrder = await client.query(
        `INSERT INTO orders ("orderNumber", "userId", status, subtotal, "discountAmount", "taxAmount", "shippingAmount", "totalAmount", "idempotencyKey", "createdAt", "updatedAt")
         VALUES ($1, $2, 'PENDING', $3, $4, $5, $6, $7, $8, NOW(), NOW())
         RETURNING id, "orderNumber", "userId", status, subtotal, "discountAmount", "taxAmount", "shippingAmount", "totalAmount", "idempotencyKey", "createdAt", "updatedAt"`,
        [
          `ORD-${Date.now().toString(36).toUpperCase()}`,
          userId,
          subtotal,
          discountAmount,
          taxAmount,
          shippingAmount,
          totalAmount,
          idempotencyKey,
        ],
      );

      const orderId = newOrder.rows[0].id;

      // Create order items
      for (const item of orderItems) {
        await client.query(
          `INSERT INTO order_items ("orderId", "productId", "variantId", "productName", "productSku", "variantName", quantity, "unitPrice", "totalPrice", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
          [
            orderId,
            item.productId,
            item.variantId,
            item.productName,
            item.productSku,
            item.variantName,
            item.quantity,
            item.unitPrice,
            item.totalPrice,
          ],
        );
      }

      // Create shipping address, it belongs to the order and not to the
      // account, a customer can place more than one order.
      if (shippingAddress) {
        await client.query(
          `INSERT INTO addresses ("orderId", "firstName", "lastName", company, "addressLine1", phone, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
          [
            orderId,
            shippingAddress.firstName,
            shippingAddress.lastName,
            shippingAddress.company ?? null,
            shippingAddress.addressLine1,
            shippingAddress.phone,
          ],
        );
      }

      // Reserve stock
      for (const reservation of reservations) {
        await client.query(
          `UPDATE inventory SET "reservedQuantity" = "reservedQuantity" + $1, "updatedAt" = NOW() WHERE "productId" = $2 AND ("variantId" = $3 OR ("variantId" IS NULL AND $3 IS NULL))`,
          [reservation.quantity, reservation.productId, reservation.variantId],
        );

        await client.query(
          `INSERT INTO inventory_movements ("inventoryId", type, quantity, "referenceId", "referenceType", notes, "createdAt")
           VALUES ($1, 'RESERVATION', $2, $3, 'order', $4, NOW())`,
          [
            reservation.inventoryId,
            reservation.quantity,
            orderId,
            `Stock reserved for order ${newOrder.rows[0].orderNumber}`,
          ],
        );
      }

      // Clear cart
      await client.query(
        'DELETE FROM cart_items WHERE "cartId" = $1',
        [cartRow.id],
      );

      return newOrder.rows[0];
    });

    return order;
  }
}
