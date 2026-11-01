import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateDiscountDto, DiscountType } from './dto/create-discount.dto';
import { UpdateDiscountDto } from './dto/update-discount.dto';
import { ListDiscountsDto } from './dto/list-discounts.dto';

type StoredDiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';

@Injectable()
export class DiscountsService {
  constructor(private db: DatabaseService) {}

  /**
   * The API accepts `FIXED` and `FIXED_AMOUNT` as synonyms, the database only
   * knows about `FIXED_AMOUNT`.
   */
  private toStoredType(type: DiscountType): StoredDiscountType {
    return type === DiscountType.PERCENTAGE ? 'PERCENTAGE' : 'FIXED_AMOUNT';
  }

  private normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  private assertValidValue(type: StoredDiscountType, value: number): void {
    if (type === 'PERCENTAGE' && value > 100) {
      throw new BadRequestException(
        'A percentage discount cannot be greater than 100',
      );
    }
  }

  private assertValidPeriod(startDate: Date, endDate: Date): void {
    if (endDate.getTime() <= startDate.getTime()) {
      throw new BadRequestException(
        'The end date must be after the start date',
      );
    }
  }

  async create(createDiscountDto: CreateDiscountDto) {
    const {
      code,
      type,
      value,
      startDate,
      endDate,
      minPurchase,
      maxDiscount,
      maxUses,
      isActive,
    } = createDiscountDto;

    const normalizedCode = this.normalizeCode(code);
    const storedType = this.toStoredType(type);
    const startsAt = new Date(startDate);
    const expiresAt = new Date(endDate);

    this.assertValidValue(storedType, value);
    this.assertValidPeriod(startsAt, expiresAt);

    const existingCode = await this.db.query(
      'SELECT id FROM coupons WHERE code = $1',
      [normalizedCode],
    );

    if (existingCode.rows.length > 0) {
      throw new ConflictException('Discount with this code already exists');
    }

    const result = await this.db.query(
      `INSERT INTO coupons (code, type, value, min_order_amount, max_discount_amount, usage_limit, starts_at, expires_at, "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING id, code, type, value, min_order_amount, max_discount_amount, usage_limit, starts_at, expires_at, "isActive", "createdAt", "updatedAt"`,
      [
        normalizedCode,
        storedType,
        value,
        minPurchase ?? null,
        maxDiscount ?? null,
        maxUses ?? null,
        startsAt,
        expiresAt,
        isActive ?? true,
      ],
    );

    return result.rows[0];
  }

  async findAll(query: ListDiscountsDto = {}) {
    const { limit = 20, offset = 0, search, isActive, type } = query;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`code ILIKE $${paramIndex++}`);
      values.push(`%${search}%`);
    }
    if (isActive !== undefined) {
      conditions.push(`"isActive" = $${paramIndex++}`);
      values.push(isActive);
    }
    if (type) {
      conditions.push(`type = $${paramIndex++}`);
      values.push(this.toStoredType(type));
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.db.query(
      `SELECT id, code, type, value, min_order_amount, max_discount_amount, usage_limit, starts_at, expires_at, "isActive", "createdAt", "updatedAt"
       FROM coupons ${whereClause}
       ORDER BY "createdAt" DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...values, limit, offset],
    );

    return result.rows;
  }

  async findOne(id: string) {
    const result = await this.db.query(
      'SELECT id, code, type, value, min_order_amount, max_discount_amount, usage_limit, starts_at, expires_at, "isActive", "createdAt", "updatedAt" FROM coupons WHERE id = $1',
      [id],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Discount not found');
    }

    return result.rows[0];
  }

  async findByCode(code: string) {
    const result = await this.db.query(
      'SELECT id, code, type, value, min_order_amount, max_discount_amount, usage_limit, starts_at, expires_at, "isActive", "createdAt", "updatedAt" FROM coupons WHERE code = $1',
      [this.normalizeCode(code)],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Discount not found');
    }

    return result.rows[0];
  }

  /**
   * Returns the coupons that are currently available for customers to use:
   * active, started, and not yet expired.
   */
  async findAvailable() {
    const now = new Date();

    const result = await this.db.query(
      `SELECT id, code, type, value, min_order_amount, max_discount_amount, usage_limit, starts_at, expires_at, "isActive", "createdAt", "updatedAt"
       FROM coupons
       WHERE "isActive" = true AND starts_at <= $1 AND expires_at >= $1
       ORDER BY code ASC`,
      [now],
    );

    return result.rows;
  }

  async update(id: string, updateDiscountDto: UpdateDiscountDto) {
    const {
      code,
      startDate,
      endDate,
      type,
      value,
      minPurchase,
      maxDiscount,
      maxUses,
      isActive,
    } = updateDiscountDto;

    const existing = await this.db.query(
      'SELECT id, code, type, value, min_order_amount, max_discount_amount, usage_limit, starts_at, expires_at, "isActive" FROM coupons WHERE id = $1',
      [id],
    );

    if (existing.rows.length === 0) {
      throw new NotFoundException('Discount not found');
    }

    const current = existing.rows[0];
    const storedType = type ? this.toStoredType(type) : current.type;
    const nextValue = value ?? current.value;

    this.assertValidValue(storedType, nextValue);

    const startsAt = startDate ? new Date(startDate) : current.starts_at;
    const expiresAt = endDate ? new Date(endDate) : current.expires_at;

    this.assertValidPeriod(startsAt, expiresAt);

    const updateFields: string[] = [];
    const updateValues: unknown[] = [];
    let paramIndex = 1;

    if (code) {
      const normalizedCode = this.normalizeCode(code);

      if (normalizedCode !== current.code) {
        const existingCode = await this.db.query(
          'SELECT id FROM coupons WHERE code = $1 AND id != $2',
          [normalizedCode, id],
        );

        if (existingCode.rows.length > 0) {
          throw new ConflictException('Discount with this code already exists');
        }
      }

      updateFields.push(`code = $${paramIndex++}`);
      updateValues.push(normalizedCode);
    }
    if (type !== undefined) {
      updateFields.push(`type = $${paramIndex++}`);
      updateValues.push(storedType);
    }
    if (value !== undefined) {
      updateFields.push(`value = $${paramIndex++}`);
      updateValues.push(value);
    }
    if (minPurchase !== undefined) {
      updateFields.push(`min_order_amount = $${paramIndex++}`);
      updateValues.push(minPurchase);
    }
    if (maxDiscount !== undefined) {
      updateFields.push(`max_discount_amount = $${paramIndex++}`);
      updateValues.push(maxDiscount);
    }
    if (maxUses !== undefined) {
      updateFields.push(`usage_limit = $${paramIndex++}`);
      updateValues.push(maxUses);
    }
    if (startDate) {
      updateFields.push(`starts_at = $${paramIndex++}`);
      updateValues.push(startsAt);
    }
    if (endDate) {
      updateFields.push(`expires_at = $${paramIndex++}`);
      updateValues.push(expiresAt);
    }
    if (isActive !== undefined) {
      updateFields.push(`"isActive" = $${paramIndex++}`);
      updateValues.push(isActive);
    }

    updateFields.push(`"updatedAt" = NOW()`);
    updateValues.push(id);

    const result = await this.db.query(
      `UPDATE coupons SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING id, code, type, value, min_order_amount, max_discount_amount, usage_limit, starts_at, expires_at, "isActive", "createdAt", "updatedAt"`,
      updateValues,
    );

    return result.rows[0];
  }

  async remove(id: string) {
    const existing = await this.db.query(
      'SELECT id FROM coupons WHERE id = $1',
      [id],
    );

    if (existing.rows.length === 0) {
      throw new NotFoundException('Discount not found');
    }

    await this.db.query('DELETE FROM coupons WHERE id = $1', [id]);

    return { id };
  }
}
