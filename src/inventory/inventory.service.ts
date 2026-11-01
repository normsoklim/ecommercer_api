import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';

@Injectable()
export class InventoryService {
  constructor(private db: DatabaseService) {}

  async getInventory(productId: string, variantId?: string) {
    const whereConditions: string[] = ['"productId" = $1'];
    const values: unknown[] = [productId];
    let paramIndex = 2;

    if (variantId) {
      whereConditions.push(`"variantId" = $${paramIndex++}`);
      values.push(variantId);
    } else {
      whereConditions.push(`"variantId" IS NULL`);
    }

    const result = await this.db.query(
      `SELECT i.*, 
        (SELECT json_agg(im ORDER BY im."createdAt" DESC LIMIT 50) FROM inventory_movements im WHERE im."inventoryId" = i.id) as movements
       FROM inventory i
       WHERE ${whereConditions.join(' AND ')}
       LIMIT 1`,
      values,
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Inventory record not found');
    }

    return result.rows[0];
  }

  async adjustInventory(adjustInventoryDto: AdjustInventoryDto) {
    const {
      productId,
      variantId,
      quantity,
      referenceId,
      referenceType,
      notes,
      reason,
    } = adjustInventoryDto;

    const type = adjustInventoryDto.type ?? 'ADJUSTMENT';
    const movementNotes = notes ?? reason;

    if (!Number.isInteger(quantity)) {
      throw new ConflictException('Quantity must be an integer');
    }

    const whereConditions: string[] = ['"productId" = $1'];
    const values: unknown[] = [productId];
    let paramIndex = 2;

    if (variantId) {
      whereConditions.push(`"variantId" = $${paramIndex++}`);
      values.push(variantId);
    } else {
      whereConditions.push(`"variantId" IS NULL`);
    }

    const existing = await this.db.query(
      `SELECT * FROM inventory WHERE ${whereConditions.join(' AND ')} LIMIT 1`,
      values,
    );

    if (existing.rows.length === 0) {
      const product = await this.db.query(
        'SELECT id FROM products WHERE id = $1',
        [productId],
      );

      if (product.rows.length === 0) {
        throw new NotFoundException('Product not found');
      }

      const created = await this.db.query(
        `INSERT INTO inventory ("productId", "variantId", quantity, "reservedQuantity", "createdAt", "updatedAt")
         VALUES ($1, $2, 0, 0, NOW(), NOW())
         RETURNING id, "productId", "variantId", quantity, "reservedQuantity", "createdAt", "updatedAt"`,
        [productId, variantId ?? null],
      );

      return this.applyMovement(
        created.rows[0],
        type,
        quantity,
        referenceId,
        referenceType,
        movementNotes,
      );
    }

    return this.applyMovement(
      existing.rows[0],
      type,
      quantity,
      referenceId,
      referenceType,
      movementNotes,
    );
  }

  private async applyMovement(
    inventory: { id: string; quantity: number; reservedQuantity: number },
    type: string,
    quantity: number,
    referenceId?: string,
    referenceType?: string,
    notes?: string,
  ) {
    let newQuantity: number;
    let newReserved: number;

    switch (type) {
      case 'STOCK_IN':
        newQuantity = inventory.quantity + Math.abs(quantity);
        newReserved = inventory.reservedQuantity;
        break;
      case 'STOCK_OUT':
        if (inventory.quantity < Math.abs(quantity)) {
          throw new ConflictException('Insufficient stock');
        }
        newQuantity = inventory.quantity - Math.abs(quantity);
        newReserved = inventory.reservedQuantity;
        break;
      case 'RESERVATION':
        if (
          inventory.quantity - inventory.reservedQuantity <
          Math.abs(quantity)
        ) {
          throw new ConflictException('Insufficient available stock');
        }
        newQuantity = inventory.quantity;
        newReserved = inventory.reservedQuantity + Math.abs(quantity);
        break;
      case 'RELEASE':
        if (inventory.reservedQuantity < Math.abs(quantity)) {
          throw new ConflictException('Insufficient reserved stock');
        }
        newQuantity = inventory.quantity;
        newReserved = inventory.reservedQuantity - Math.abs(quantity);
        break;
      case 'ADJUSTMENT':
        newQuantity = inventory.quantity + quantity;
        newReserved = inventory.reservedQuantity;
        break;
      default:
        throw new ConflictException('Invalid inventory movement type');
    }

    if (newQuantity < 0) {
      throw new ConflictException('Insufficient stock');
    }

    return this.db.transaction(async (client) => {
      await client.query(
        `UPDATE inventory SET quantity = $1, "reservedQuantity" = $2, "updatedAt" = NOW() WHERE id = $3`,
        [newQuantity, newReserved, inventory.id],
      );

      const movementQuantity =
        type === 'STOCK_OUT' || type === 'RELEASE'
          ? -Math.abs(quantity)
          : type === 'ADJUSTMENT'
            ? quantity
            : Math.abs(quantity);

      await client.query(
        `INSERT INTO inventory_movements ("inventoryId", type, quantity, "referenceId", "referenceType", notes, "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          inventory.id,
          type,
          movementQuantity,
          referenceId,
          referenceType,
          notes,
        ],
      );

      return { id: inventory.id, quantity: newQuantity, reservedQuantity: newReserved };
    });
  }

  async reserveStock(
    productId: string,
    variantId: string | undefined,
    quantity: number,
    orderId: string,
  ) {
    const whereConditions: string[] = ['"productId" = $1'];
    const values: unknown[] = [productId];
    let paramIndex = 2;

    if (variantId) {
      whereConditions.push(`"variantId" = $${paramIndex++}`);
      values.push(variantId);
    } else {
      whereConditions.push(`"variantId" IS NULL`);
    }

    const inventory = await this.db.query(
      `SELECT * FROM inventory WHERE ${whereConditions.join(' AND ')} LIMIT 1`,
      values,
    );

    if (inventory.rows.length === 0) {
      throw new NotFoundException('Inventory record not found');
    }

    const inv = inventory.rows[0];

    if (inv.quantity - inv.reservedQuantity < quantity) {
      throw new ConflictException('Insufficient available stock');
    }

    return this.db.transaction(async (client) => {
      await client.query(
        `UPDATE inventory SET "reservedQuantity" = "reservedQuantity" + $1, "updatedAt" = NOW() WHERE id = $2`,
        [quantity, inv.id],
      );

      await client.query(
        `INSERT INTO inventory_movements ("inventoryId", type, quantity, "referenceId", "referenceType", notes, "createdAt")
         VALUES ($1, 'RESERVATION', $2, $3, 'order', $4, NOW())`,
        [inv.id, quantity, orderId, `Stock reserved for order ${orderId}`],
      );

      return { id: inv.id, reservedQuantity: inv.reservedQuantity + quantity };
    });
  }

  async releaseStock(
    productId: string,
    variantId: string | undefined,
    quantity: number,
    orderId: string,
  ) {
    const whereConditions: string[] = ['"productId" = $1'];
    const values: unknown[] = [productId];
    let paramIndex = 2;

    if (variantId) {
      whereConditions.push(`"variantId" = $${paramIndex++}`);
      values.push(variantId);
    } else {
      whereConditions.push(`"variantId" IS NULL`);
    }

    const inventory = await this.db.query(
      `SELECT * FROM inventory WHERE ${whereConditions.join(' AND ')} LIMIT 1`,
      values,
    );

    if (inventory.rows.length === 0) {
      throw new NotFoundException('Inventory record not found');
    }

    const inv = inventory.rows[0];

    return this.db.transaction(async (client) => {
      await client.query(
        `UPDATE inventory SET "reservedQuantity" = GREATEST(0, "reservedQuantity" - $1), "updatedAt" = NOW() WHERE id = $2`,
        [quantity, inv.id],
      );

      await client.query(
        `INSERT INTO inventory_movements ("inventoryId", type, quantity, "referenceId", "referenceType", notes, "createdAt")
         VALUES ($1, 'RELEASE', $2, $3, 'order', $4, NOW())`,
        [inv.id, -Math.abs(quantity), orderId, `Stock released for order ${orderId}`],
      );

      return { id: inv.id, reservedQuantity: Math.max(0, inv.reservedQuantity - quantity) };
    });
  }

  async confirmStock(
    productId: string,
    variantId: string | undefined,
    quantity: number,
    orderId: string,
  ) {
    const whereConditions: string[] = ['"productId" = $1'];
    const values: unknown[] = [productId];
    let paramIndex = 2;

    if (variantId) {
      whereConditions.push(`"variantId" = $${paramIndex++}`);
      values.push(variantId);
    } else {
      whereConditions.push(`"variantId" IS NULL`);
    }

    const inventory = await this.db.query(
      `SELECT * FROM inventory WHERE ${whereConditions.join(' AND ')} LIMIT 1`,
      values,
    );

    if (inventory.rows.length === 0) {
      throw new NotFoundException('Inventory record not found');
    }

    const inv = inventory.rows[0];

    return this.db.transaction(async (client) => {
      await client.query(
        `UPDATE inventory SET quantity = quantity - $1, "reservedQuantity" = GREATEST(0, "reservedQuantity" - $1), "updatedAt" = NOW() WHERE id = $2`,
        [quantity, inv.id],
      );

      await client.query(
        `INSERT INTO inventory_movements ("inventoryId", type, quantity, "referenceId", "referenceType", notes, "createdAt")
         VALUES ($1, 'STOCK_OUT', $2, $3, 'order', $4, NOW())`,
        [inv.id, -Math.abs(quantity), orderId, `Stock confirmed for order ${orderId}`],
      );

      return { id: inv.id, quantity: inv.quantity - quantity, reservedQuantity: Math.max(0, inv.reservedQuantity - quantity) };
    });
  }
}
