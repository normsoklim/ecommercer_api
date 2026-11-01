import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateProductImageDto } from './dto/create-product-image.dto';
import { UpdateProductImageDto } from './dto/update-product-image.dto';
import { ReorderProductImagesDto } from './dto/reorder-product-images.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

@Injectable()
export class ProductImagesService {
  constructor(private db: DatabaseService) {}

  async create(createProductImageDto: CreateProductImageDto) {
    const { productId, url, altText, sortOrder, isPrimary } =
      createProductImageDto;

    await this.assertProductExists(productId);

    return this.db.transaction(async (client) => {
      const countResult = await client.query(
        'SELECT COUNT(*) FROM product_images WHERE "productId" = $1',
        [productId],
      );

      // The very first image of a product always becomes the primary one,
      // otherwise the storefront would have nothing to render.
      const existingCount = parseInt(countResult.rows[0].count, 10);
      const shouldBePrimary = isPrimary ?? existingCount === 0;

      if (shouldBePrimary) {
        await this.clearPrimary(client, productId);
      }

      const imageResult = await client.query(
        `INSERT INTO product_images ("productId", url, "altText", "sortOrder", "isPrimary", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING id, "productId", url, "altText", "sortOrder", "isPrimary", "createdAt", "updatedAt"`,
        [productId, url, altText, sortOrder ?? existingCount, shouldBePrimary],
      );

      const image = imageResult.rows[0];

      // Fetch with product details
      const detailResult = await client.query(
        `SELECT pi.*,
          p.id as product_id, p.name as product_name, p.slug as product_slug, p.sku as product_sku
         FROM product_images pi
         JOIN products p ON p.id = pi."productId"
         WHERE pi.id = $1`,
        [image.id],
      );

      return detailResult.rows[0];
    });
  }

  async findAll(
    page = DEFAULT_PAGE,
    limit = DEFAULT_LIMIT,
    productId?: string,
    isPrimary?: boolean,
  ) {
    const safePage = this.normalizePositiveInt(page, DEFAULT_PAGE, 'page');
    const safeLimit = Math.min(
      this.normalizePositiveInt(limit, DEFAULT_LIMIT, 'limit'),
      MAX_LIMIT,
    );
    const skip = (safePage - 1) * safeLimit;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (productId) {
      conditions.push(`"productId" = $${paramIndex++}`);
      values.push(productId);
    }

    if (isPrimary !== undefined) {
      conditions.push(`"isPrimary" = $${paramIndex++}`);
      values.push(isPrimary);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [imagesResult, totalResult] = await Promise.all([
      this.db.query(
        `SELECT pi.*,
          p.id as product_id, p.name as product_name, p.slug as product_slug, p.sku as product_sku
         FROM product_images pi
         JOIN products p ON p.id = pi."productId"
         ${whereClause}
         ORDER BY pi."sortOrder" ASC, pi."createdAt" ASC
         LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...values, safeLimit, skip],
      ),
      this.db.query(
        `SELECT COUNT(*) FROM product_images pi ${whereClause}`,
        values,
      ),
    ]);

    return {
      data: imagesResult.rows,
      meta: {
        page: safePage,
        limit: safeLimit,
        total: parseInt(totalResult.rows[0].count, 10),
        totalPages: Math.ceil(parseInt(totalResult.rows[0].count, 10) / safeLimit),
      },
    };
  }

  async findByProduct(productId: string) {
    await this.assertProductExists(productId);

    const result = await this.db.query(
      `SELECT pi.*,
        p.id as product_id, p.name as product_name, p.slug as product_slug, p.sku as product_sku
       FROM product_images pi
       JOIN products p ON p.id = pi."productId"
       WHERE pi."productId" = $1
       ORDER BY pi."sortOrder" ASC, pi."createdAt" ASC`,
      [productId],
    );

    return result.rows;
  }

  async findOne(id: string) {
    const result = await this.db.query(
      `SELECT pi.*,
        p.id as product_id, p.name as product_name, p.slug as product_slug, p.sku as product_sku
       FROM product_images pi
       JOIN products p ON p.id = pi."productId"
       WHERE pi.id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Product image not found');
    }

    return result.rows[0];
  }

  async update(id: string, updateProductImageDto: UpdateProductImageDto) {
    const { url, altText, sortOrder, isPrimary } = updateProductImageDto;

    const existing = await this.db.query(
      'SELECT id, "productId" FROM product_images WHERE id = $1',
      [id],
    );

    if (existing.rows.length === 0) {
      throw new NotFoundException('Product image not found');
    }

    return this.db.transaction(async (client) => {
      if (isPrimary === true) {
        await this.clearPrimary(client, existing.rows[0].productId, id);
      }

      const updateFields: string[] = [];
      const updateValues: unknown[] = [];
      let paramIndex = 1;

      if (url !== undefined) {
        updateFields.push(`url = $${paramIndex++}`);
        updateValues.push(url);
      }
      if (altText !== undefined) {
        updateFields.push(`"altText" = $${paramIndex++}`);
        updateValues.push(altText);
      }
      if (sortOrder !== undefined) {
        updateFields.push(`"sortOrder" = $${paramIndex++}`);
        updateValues.push(sortOrder);
      }
      if (isPrimary !== undefined) {
        updateFields.push(`"isPrimary" = $${paramIndex++}`);
        updateValues.push(isPrimary);
      }

      if (updateFields.length > 0) {
        updateFields.push(`"updatedAt" = NOW()`);
        updateValues.push(id);

        await client.query(
          `UPDATE product_images SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
          updateValues,
        );
      }

      const detailResult = await client.query(
        `SELECT pi.*,
          p.id as product_id, p.name as product_name, p.slug as product_slug, p.sku as product_sku
         FROM product_images pi
         JOIN products p ON p.id = pi."productId"
         WHERE pi.id = $1`,
        [id],
      );

      return detailResult.rows[0];
    });
  }

  /**
   * Promotes a single image to be the primary one of its product and demotes
   * every other image of that product.
   */
  async setPrimary(id: string) {
    const existing = await this.db.query(
      'SELECT id, "productId" FROM product_images WHERE id = $1',
      [id],
    );

    if (existing.rows.length === 0) {
      throw new NotFoundException('Product image not found');
    }

    return this.db.transaction(async (client) => {
      await this.clearPrimary(client, existing.rows[0].productId, id);

      const imageResult = await client.query(
        `UPDATE product_images SET "isPrimary" = true, "updatedAt" = NOW() WHERE id = $1 RETURNING id, "productId", url, "altText", "sortOrder", "isPrimary", "createdAt", "updatedAt"`,
        [id],
      );

      const image = imageResult.rows[0];

      // Fetch with product details
      const detailResult = await client.query(
        `SELECT pi.*,
          p.id as product_id, p.name as product_name, p.slug as product_slug, p.sku as product_sku
         FROM product_images pi
         JOIN products p ON p.id = pi."productId"
         WHERE pi.id = $1`,
        [image.id],
      );

      return detailResult.rows[0];
    });
  }

  async remove(id: string) {
    const existing = await this.db.query(
      'SELECT id, "productId", "isPrimary" FROM product_images WHERE id = $1',
      [id],
    );

    if (existing.rows.length === 0) {
      throw new NotFoundException('Product image not found');
    }

    return this.db.transaction(async (client) => {
      await client.query('DELETE FROM product_images WHERE id = $1', [id]);

      // Keep the product displayable: when the removed image was the primary
      // one, promote the first remaining image.
      if (existing.rows[0].isPrimary) {
        const next = await client.query(
          `SELECT id FROM product_images WHERE "productId" = $1 ORDER BY "sortOrder" ASC, "createdAt" ASC LIMIT 1`,
          [existing.rows[0].productId],
        );

        if (next.rows.length > 0) {
          await client.query(
            `UPDATE product_images SET "isPrimary" = true, "updatedAt" = NOW() WHERE id = $1`,
            [next.rows[0].id],
          );
        }
      }

      return { id };
    });
  }

  async removeAllByProduct(productId: string) {
    await this.assertProductExists(productId);

    const result = await this.db.query(
      'DELETE FROM product_images WHERE "productId" = $1',
      [productId],
    );

    return { productId, deletedCount: result.rowCount ?? 0 };
  }

  async reorder(reorderProductImagesDto: ReorderProductImagesDto) {
    const { images, productId } = reorderProductImagesDto;

    if (productId) {
      await this.assertProductExists(productId);
    }

    const ids = images.map((image) => image.id);

    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        'The reorder payload contains duplicated image ids',
      );
    }

    const existing = await this.db.query(
      'SELECT id, "productId" FROM product_images WHERE id = ANY($1)',
      [ids],
    );

    if (existing.rows.length !== ids.length) {
      throw new NotFoundException(
        'One or more product images of the reorder payload do not exist',
      );
    }

    if (productId) {
      const foreign = existing.rows.find((image: any) => image.productId !== productId);
      if (foreign) {
        throw new BadRequestException(
          'All the images to reorder must belong to the same product',
        );
      }
    }

    const productIds = [...new Set(existing.rows.map((image: any) => image.productId))];
    if (productIds.length > 1) {
      throw new BadRequestException(
        'All the images to reorder must belong to the same product',
      );
    }

    return this.db.transaction(async (client) => {
      for (const image of images) {
        await client.query(
          `UPDATE product_images SET "sortOrder" = $1, "updatedAt" = NOW() WHERE id = $2`,
          [image.sortOrder, image.id],
        );
      }

      const result = await client.query(
        `SELECT pi.*,
          p.id as product_id, p.name as product_name, p.slug as product_slug, p.sku as product_sku
         FROM product_images pi
         JOIN products p ON p.id = pi."productId"
         WHERE pi."productId" = $1
         ORDER BY pi."sortOrder" ASC, pi."createdAt" ASC`,
        [productIds[0]],
      );

      return result.rows;
    });
  }

  /**
   * Demotes the current primary image(s) of a product. When `keepId` is
   * provided that image keeps the primary flag.
   */
  private async clearPrimary(
    client: any,
    productId: string,
    keepId?: string,
  ) {
    if (keepId) {
      await client.query(
        `UPDATE product_images SET "isPrimary" = false, "updatedAt" = NOW() WHERE "productId" = $1 AND "isPrimary" = true AND id != $2`,
        [productId, keepId],
      );
    } else {
      await client.query(
        `UPDATE product_images SET "isPrimary" = false, "updatedAt" = NOW() WHERE "productId" = $1 AND "isPrimary" = true`,
        [productId],
      );
    }
  }

  private async assertProductExists(productId: string) {
    const result = await this.db.query(
      'SELECT id FROM products WHERE id = $1',
      [productId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Product not found');
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
