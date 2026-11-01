import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

@Injectable()
export class ProductsService {
  constructor(private db: DatabaseService) {}

  async create(createProductDto: CreateProductDto) {
    const {
      name,
      slug,
      sku,
      categoryId,
      description,
      shortDescription,
      basePrice,
      compareAtPrice,
      weight,
      isActive,
      isFeatured,
    } = createProductDto;

    await this.assertSlugIsAvailable(slug);
    await this.assertSkuIsAvailable(sku);
    await this.assertCategoryExists(categoryId);

    return this.db.transaction(async (client) => {
      const productResult = await client.query(
        `INSERT INTO products (name, slug, sku, "categoryId", description, "shortDescription", "basePrice", "compareAtPrice", weight, "isActive", "isFeatured", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
         RETURNING id, name, slug, sku, "categoryId", description, "shortDescription", "basePrice", "compareAtPrice", weight, "isActive", "isFeatured", "createdAt", "updatedAt"`,
        [
          name,
          slug,
          sku,
          categoryId,
          description,
          shortDescription,
          basePrice,
          compareAtPrice,
          weight,
          isActive,
          isFeatured,
        ],
      );

      const product = productResult.rows[0];

      // A product always needs an inventory row
      await client.query(
        `INSERT INTO inventory ("productId", "variantId", quantity, "reservedQuantity", "createdAt", "updatedAt")
         VALUES ($1, NULL, 0, 0, NOW(), NOW())`,
        [product.id],
      );

      // Fetch product with relations
      const fullProduct = await client.query(
        `SELECT p.*,
          c.id as category_id, c.name as category_name, c.slug as category_slug,
          (SELECT COALESCE(json_agg(pi ORDER BY pi."sortOrder" ASC), '[]'::json) FROM product_images pi WHERE pi."productId" = p.id) as images,
          (SELECT COALESCE(json_agg(pv), '[]'::json) FROM product_variants pv WHERE pv."productId" = p.id) as variants,
          (SELECT COALESCE(json_agg(i), '[]'::json) FROM inventory i WHERE i."productId" = p.id) as inventory
         FROM products p
         LEFT JOIN categories c ON c.id = p."categoryId"
         WHERE p.id = $1`,
        [product.id],
      );

      return fullProduct.rows[0];
    });
  }

  async findAll(
    page = DEFAULT_PAGE,
    limit = DEFAULT_LIMIT,
    categoryId?: string,
    search?: string,
  ) {
    const safePage = this.normalizePositiveInt(page, DEFAULT_PAGE, 'page');
    const safeLimit = Math.min(
      this.normalizePositiveInt(limit, DEFAULT_LIMIT, 'limit'),
      MAX_LIMIT,
    );
    const skip = (safePage - 1) * safeLimit;

    const conditions: string[] = ['p."isActive" = true'];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (categoryId) {
      conditions.push(`"categoryId" = $${paramIndex++}`);
      values.push(categoryId);
    }

    if (search?.trim()) {
      conditions.push(`(name ILIKE $${paramIndex} OR sku ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      values.push(`%${search.trim()}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const [productsResult, totalResult] = await Promise.all([
      this.db.query(
        `SELECT p.*,
          c.id as category_id, c.name as category_name, c.slug as category_slug,
          (SELECT COALESCE(json_agg(pi ORDER BY pi."sortOrder" ASC), '[]'::json) FROM product_images pi WHERE pi."productId" = p.id) as images,
          (SELECT COALESCE(json_agg(pv), '[]'::json) FROM product_variants pv WHERE pv."productId" = p.id) as variants,
          (SELECT COALESCE(json_agg(i), '[]'::json) FROM inventory i WHERE i."productId" = p.id) as inventory
         FROM products p
         LEFT JOIN categories c ON c.id = p."categoryId"
         WHERE ${whereClause}
         ORDER BY p."createdAt" DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...values, safeLimit, skip],
      ),
      this.db.query(
        `SELECT COUNT(*) FROM products p WHERE ${whereClause}`,
        values,
      ),
    ]);

    return {
      data: productsResult.rows,
      meta: {
        page: safePage,
        limit: safeLimit,
        total: parseInt(totalResult.rows[0].count, 10),
        totalPages: Math.ceil(parseInt(totalResult.rows[0].count, 10) / safeLimit),
      },
    };
  }

  async findOne(id: string) {
    const result = await this.db.query(
      `SELECT p.*,
        c.id as category_id, c.name as category_name, c.slug as category_slug,
        (SELECT COALESCE(json_agg(pi ORDER BY pi."sortOrder" ASC), '[]'::json) FROM product_images pi WHERE pi."productId" = p.id) as images,
        (SELECT COALESCE(json_agg(pv), '[]'::json) FROM product_variants pv WHERE pv."productId" = p.id) as variants,
        (SELECT COALESCE(json_agg(i), '[]'::json) FROM inventory i WHERE i."productId" = p.id) as inventory,
        (SELECT COALESCE(json_agg(r ORDER BY r."createdAt" DESC), '[]'::json) FROM reviews r WHERE r."productId" = p.id AND r."isActive" = true) as reviews
       FROM products p
       LEFT JOIN categories c ON c.id = p."categoryId"
       WHERE p.id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Product not found');
    }

    return result.rows[0];
  }

  async findBySlug(slug: string) {
    const result = await this.db.query(
      `SELECT p.*,
        c.id as category_id, c.name as category_name, c.slug as category_slug,
        (SELECT COALESCE(json_agg(pi ORDER BY pi."sortOrder" ASC), '[]'::json) FROM product_images pi WHERE pi."productId" = p.id) as images,
        (SELECT COALESCE(json_agg(pv), '[]'::json) FROM product_variants pv WHERE pv."productId" = p.id) as variants,
        (SELECT COALESCE(json_agg(i), '[]'::json) FROM inventory i WHERE i."productId" = p.id) as inventory,
        (SELECT COALESCE(json_agg(r ORDER BY r."createdAt" DESC), '[]'::json) FROM reviews r WHERE r."productId" = p.id AND r."isActive" = true) as reviews
       FROM products p
       LEFT JOIN categories c ON c.id = p."categoryId"
       WHERE p.slug = $1`,
      [slug],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Product not found');
    }

    return result.rows[0];
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const {
      name,
      slug,
      sku,
      categoryId,
      description,
      shortDescription,
      basePrice,
      compareAtPrice,
      weight,
      isActive,
      isFeatured,
    } = updateProductDto;

    const existing = await this.db.query(
      'SELECT id, slug, sku, "categoryId" FROM products WHERE id = $1',
      [id],
    );

    if (existing.rows.length === 0) {
      throw new NotFoundException('Product not found');
    }

    if (slug && slug !== existing.rows[0].slug) {
      await this.assertSlugIsAvailable(slug, id);
    }

    if (sku && sku !== existing.rows[0].sku) {
      await this.assertSkuIsAvailable(sku, id);
    }

    if (categoryId && categoryId !== existing.rows[0].categoryId) {
      await this.assertCategoryExists(categoryId);
    }

    const updateFields: string[] = [];
    const updateValues: unknown[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      updateValues.push(name);
    }
    if (slug !== undefined) {
      updateFields.push(`slug = $${paramIndex++}`);
      updateValues.push(slug);
    }
    if (sku !== undefined) {
      updateFields.push(`sku = $${paramIndex++}`);
      updateValues.push(sku);
    }
    if (categoryId !== undefined) {
      updateFields.push(`"categoryId" = $${paramIndex++}`);
      updateValues.push(categoryId);
    }
    if (description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      updateValues.push(description);
    }
    if (shortDescription !== undefined) {
      updateFields.push(`"shortDescription" = $${paramIndex++}`);
      updateValues.push(shortDescription);
    }
    if (basePrice !== undefined) {
      updateFields.push(`"basePrice" = $${paramIndex++}`);
      updateValues.push(basePrice);
    }
    if (compareAtPrice !== undefined) {
      updateFields.push(`"compareAtPrice" = $${paramIndex++}`);
      updateValues.push(compareAtPrice);
    }
    if (weight !== undefined) {
      updateFields.push(`weight = $${paramIndex++}`);
      updateValues.push(weight);
    }
    if (isActive !== undefined) {
      updateFields.push(`"isActive" = $${paramIndex++}`);
      updateValues.push(isActive);
    }
    if (isFeatured !== undefined) {
      updateFields.push(`"isFeatured" = $${paramIndex++}`);
      updateValues.push(isFeatured);
    }

    updateFields.push(`"updatedAt" = NOW()`);
    updateValues.push(id);

    const result = await this.db.query(
      `UPDATE products SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING id, name, slug, sku, "categoryId", description, "shortDescription", "basePrice", "compareAtPrice", weight, "isActive", "isFeatured", "createdAt", "updatedAt"`,
      updateValues,
    );

    return result.rows[0];
  }

  async remove(id: string) {
    const existing = await this.db.query(
      `SELECT p.id,
        (SELECT COUNT(*) FROM order_items oi WHERE oi."productId" = p.id) as order_items_count
       FROM products p
       WHERE p.id = $1`,
      [id],
    );

    if (existing.rows.length === 0) {
      throw new NotFoundException('Product not found');
    }

    if (parseInt(existing.rows[0].order_items_count, 10) > 0) {
      throw new ConflictException('Cannot delete product with existing orders');
    }

    // Soft delete
    const result = await this.db.query(
      `UPDATE products SET "isActive" = false, "updatedAt" = NOW() WHERE id = $1 RETURNING id, name, slug, "isActive", "updatedAt"`,
      [id],
    );

    return result.rows[0];
  }

  private async assertSlugIsAvailable(slug: string, currentId?: string) {
    const result = await this.db.query(
      currentId
        ? 'SELECT id FROM products WHERE slug = $1 AND id != $2'
        : 'SELECT id FROM products WHERE slug = $1',
      currentId ? [slug, currentId] : [slug],
    );

    if (result.rows.length > 0) {
      throw new ConflictException('Product with this slug already exists');
    }
  }

  private async assertSkuIsAvailable(sku: string, currentId?: string) {
    const result = await this.db.query(
      currentId
        ? 'SELECT id FROM products WHERE sku = $1 AND id != $2'
        : 'SELECT id FROM products WHERE sku = $1',
      currentId ? [sku, currentId] : [sku],
    );

    if (result.rows.length > 0) {
      throw new ConflictException('Product with this SKU already exists');
    }
  }

  private async assertCategoryExists(categoryId: string) {
    const result = await this.db.query(
      'SELECT id FROM categories WHERE id = $1',
      [categoryId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Category not found');
    }
  }

  private normalizePositiveInt(
    value: number,
    fallback: number,
    field: string,
  ): number {
    if (value === undefined || value === null || Number.isNaN(value)) {
      return fallback;
    }

    if (!Number.isInteger(value) || value < 1) {
      throw new BadRequestException(`${field} must be a positive integer`);
    }

    return value;
  }
}
