import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { XssService } from '../common/security/xss.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ListReviewsDto } from './dto/list-reviews.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

@Injectable()
export class ReviewsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly xssService: XssService,
  ) {}

  async findAll(query: ListReviewsDto = {}, isPrivileged = false) {
    const page = query.page && query.page > 0 ? query.page : DEFAULT_PAGE;
    const limit = Math.min(
      query.limit && query.limit > 0 ? query.limit : DEFAULT_LIMIT,
      MAX_LIMIT,
    );
    const skip = (page - 1) * limit;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (isPrivileged) {
      if (query.isActive !== undefined) {
        conditions.push(`r."isActive" = $${paramIndex++}`);
        values.push(query.isActive);
      }
    } else {
      conditions.push(`r."isActive" = true`);
    }

    if (query.productId) {
      conditions.push(`"productId" = $${paramIndex++}`);
      values.push(query.productId);
    }

    if (query.rating !== undefined) {
      conditions.push(`rating = $${paramIndex++}`);
      values.push(query.rating);
    }

    if (query.userId) {
      conditions.push(`"userId" = $${paramIndex++}`);
      values.push(query.userId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [reviewsResult, totalResult] = await Promise.all([
      this.db.query(
        `SELECT r.*,
          p.id as product_id, p.name as product_name, p.slug as product_slug, p.sku as product_sku,
          u.id as user_id, u.email as user_email, u."firstName" as user_first_name, u."lastName" as user_last_name
         FROM reviews r
         LEFT JOIN products p ON p.id = r."productId"
         LEFT JOIN users u ON u.id = r."userId"
         ${whereClause}
         ORDER BY r."createdAt" DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...values, limit, skip],
      ),
      this.db.query(
        `SELECT COUNT(*) FROM reviews r ${whereClause}`,
        values,
      ),
    ]);

    return {
      data: reviewsResult.rows,
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
      `SELECT r.*,
        p.id as product_id, p.name as product_name, p.slug as product_slug, p.sku as product_sku,
        u.id as user_id, u.email as user_email, u."firstName" as user_first_name, u."lastName" as user_last_name
       FROM reviews r
       LEFT JOIN products p ON p.id = r."productId"
       LEFT JOIN users u ON u.id = r."userId"
       WHERE r.id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Review not found');
    }

    return result.rows[0];
  }

  async findByProduct(productId: string) {
    const product = await this.db.query(
      'SELECT id FROM products WHERE id = $1',
      [productId],
    );

    if (product.rows.length === 0) {
      throw new NotFoundException('Product not found');
    }

    const [reviewsResult, aggregateResult, ratingsResult] = await Promise.all([
      this.db.query(
        `SELECT r.*,
          u.id as user_id, u.email as user_email, u."firstName" as user_first_name, u."lastName" as user_last_name
         FROM reviews r
         LEFT JOIN users u ON u.id = r."userId"
         WHERE r."productId" = $1 AND r."isActive" = true
         ORDER BY r."createdAt" DESC`,
        [productId],
      ),
      this.db.query(
        `SELECT AVG(rating) as avg_rating, COUNT(*) as total_count
         FROM reviews
         WHERE "productId" = $1 AND "isActive" = true`,
        [productId],
      ),
      this.db.query(
        `SELECT rating FROM reviews WHERE "productId" = $1 AND "isActive" = true`,
        [productId],
      ),
    ]);

    const distribution: Record<string, number> = {
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
    };

    for (const entry of ratingsResult.rows) {
      distribution[String(entry.rating)] += 1;
    }

    return {
      data: reviewsResult.rows,
      meta: {
        productId,
        total: parseInt(aggregateResult.rows[0].total_count, 10),
        averageRating: parseFloat(aggregateResult.rows[0].avg_rating) || 0,
        distribution,
      },
    };
  }

  async create(userId: string, createReviewDto: CreateReviewDto) {
    const { productId, rating, title, comment } = createReviewDto;

    // Sanitize user-generated text to prevent Stored XSS.
    const cleanTitle = this.xssService.sanitizeText(title ?? '');
    const cleanComment = this.xssService.sanitizeText(comment ?? '');

    const product = await this.db.query(
      'SELECT id, "isActive" FROM products WHERE id = $1',
      [productId],
    );

    if (product.rows.length === 0 || !product.rows[0].isActive) {
      throw new NotFoundException('Product not found');
    }

    const existing = await this.db.query(
      'SELECT id FROM reviews WHERE "productId" = $1 AND "userId" = $2',
      [productId, userId],
    );

    if (existing.rows.length > 0) {
      throw new ConflictException(
        'You have already reviewed this product, update your review instead',
      );
    }

    const isVerifiedPurchase = await this.hasPurchasedProduct(userId, productId);

    const result = await this.db.query(
      `INSERT INTO reviews ("productId", "userId", rating, title, comment, "isVerifiedPurchase", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
       RETURNING id, "productId", "userId", rating, title, comment, "isVerifiedPurchase", "isActive", "createdAt", "updatedAt"`,
      [productId, userId, rating, cleanTitle, cleanComment, isVerifiedPurchase],
    );

    const review = result.rows[0];

    // Fetch product and user details
    const detailResult = await this.db.query(
      `SELECT r.*,
        p.id as product_id, p.name as product_name, p.slug as product_slug, p.sku as product_sku,
        u.id as user_id, u.email as user_email, u."firstName" as user_first_name, u."lastName" as user_last_name
       FROM reviews r
       LEFT JOIN products p ON p.id = r."productId"
       LEFT JOIN users u ON u.id = r."userId"
       WHERE r.id = $1`,
      [review.id],
    );

    return detailResult.rows[0];
  }

  async update(
    id: string,
    updateReviewDto: UpdateReviewDto,
    userId?: string,
    isPrivileged = false,
  ) {
    const existing = await this.db.query(
      'SELECT id, "userId" FROM reviews WHERE id = $1',
      [id],
    );

    if (existing.rows.length === 0) {
      throw new NotFoundException('Review not found');
    }

    if (!isPrivileged) {
      if (!userId || existing.rows[0].userId !== userId) {
        throw new ForbiddenException(
          'You are not allowed to update this review',
        );
      }

      if (updateReviewDto.isActive !== undefined) {
        throw new ForbiddenException(
          'Only an administrator can change the visibility of a review',
        );
      }
    }

    const updateFields: string[] = [];
    const updateValues: unknown[] = [];
    let paramIndex = 1;

    if (updateReviewDto.rating !== undefined) {
      updateFields.push(`rating = $${paramIndex++}`);
      updateValues.push(updateReviewDto.rating);
    }
    if (updateReviewDto.title !== undefined) {
      updateFields.push(`title = $${paramIndex++}`);
      updateValues.push(this.xssService.sanitizeText(updateReviewDto.title));
    }
    if (updateReviewDto.comment !== undefined) {
      updateFields.push(`comment = $${paramIndex++}`);
      updateValues.push(this.xssService.sanitizeText(updateReviewDto.comment));
    }
    if (updateReviewDto.isActive !== undefined) {
      updateFields.push(`"isActive" = $${paramIndex++}`);
      updateValues.push(updateReviewDto.isActive);
    }

    updateFields.push(`"updatedAt" = NOW()`);
    updateValues.push(id);

    const result = await this.db.query(
      `UPDATE reviews SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING id, "productId", "userId", rating, title, comment, "isVerifiedPurchase", "isActive", "createdAt", "updatedAt"`,
      updateValues,
    );

    return result.rows[0];
  }

  async remove(id: string, userId?: string, isPrivileged = false) {
    const existing = await this.db.query(
      'SELECT id, "userId" FROM reviews WHERE id = $1',
      [id],
    );

    if (existing.rows.length === 0) {
      throw new NotFoundException('Review not found');
    }

    if (!isPrivileged && (!userId || existing.rows[0].userId !== userId)) {
      throw new ForbiddenException('You are not allowed to delete this review');
    }

    await this.db.query('DELETE FROM reviews WHERE id = $1', [id]);

    return { id };
  }

  private async hasPurchasedProduct(
    userId: string,
    productId: string,
  ): Promise<boolean> {
    const result = await this.db.query(
      `SELECT oi.id FROM order_items oi
       JOIN orders o ON o.id = oi."orderId"
       WHERE oi."productId" = $1 AND o."userId" = $2 AND o.status IN ('CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED')
       LIMIT 1`,
      [productId, userId],
    );

    return result.rows.length > 0;
  }
}
