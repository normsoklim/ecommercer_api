import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AddToWishlistDto } from './dto/add-to-wishlist.dto';

@Injectable()
export class WishlistService {
  constructor(private db: DatabaseService) {}

  async getWishlist(userId: string) {
    let wishlist = await this.db.query(
      'SELECT id, "userId", "createdAt", "updatedAt" FROM wishlists WHERE "userId" = $1',
      [userId],
    );

    if (wishlist.rows.length === 0) {
      const createResult = await this.db.query(
        `INSERT INTO wishlists ("userId", "createdAt", "updatedAt")
         VALUES ($1, NOW(), NOW())
         RETURNING id, "userId", "createdAt", "updatedAt"`,
        [userId],
      );
      wishlist = createResult;
    }

    const wishlistId = wishlist.rows[0].id;

    const itemsResult = await this.db.query(
      `SELECT wi.id, wi."wishlistId", wi."productId", wi."createdAt",
        p.id, p.name, p.slug, p.sku, p."basePrice", p."isActive",
        (SELECT json_agg(pi ORDER BY pi."sortOrder" ASC) FROM product_images pi WHERE pi."productId" = p.id AND pi."isPrimary" = true) as images
       FROM wishlist_items wi
       JOIN products p ON p.id = wi."productId"
       WHERE wi."wishlistId" = $1
       ORDER BY wi."createdAt" ASC`,
      [wishlistId],
    );

    return {
      ...wishlist.rows[0],
      items: itemsResult.rows.map((row) => ({
        id: row.id,
        wishlistId: row.wishlistId,
        productId: row.productId,
        createdAt: row.createdAt,
        product: {
          id: row.id,
          name: row.name,
          slug: row.slug,
          sku: row.sku,
          basePrice: row.basePrice,
          isActive: row.isActive,
          images: row.images ? row.images : [],
        },
      })),
    };
  }

  async addToWishlist(userId: string, addToWishlistDto: AddToWishlistDto) {
    const { productId } = addToWishlistDto;

    const product = await this.db.query(
      'SELECT id, "isActive" FROM products WHERE id = $1',
      [productId],
    );

    if (product.rows.length === 0 || !product.rows[0].isActive) {
      throw new NotFoundException('Product not found');
    }

    // Upsert wishlist
    let wishlist = await this.db.query(
      'SELECT id FROM wishlists WHERE "userId" = $1',
      [userId],
    );

    if (wishlist.rows.length === 0) {
      const createResult = await this.db.query(
        `INSERT INTO wishlists ("userId", "createdAt", "updatedAt")
         VALUES ($1, NOW(), NOW())
         RETURNING id`,
        [userId],
      );
      wishlist = createResult;
    }

    const wishlistId = wishlist.rows[0].id;

    const existingItem = await this.db.query(
      'SELECT id FROM wishlist_items WHERE "wishlistId" = $1 AND "productId" = $2',
      [wishlistId, productId],
    );

    if (existingItem.rows.length > 0) {
      return existingItem.rows[0];
    }

    const result = await this.db.query(
      `INSERT INTO wishlist_items ("wishlistId", "productId", "createdAt")
       VALUES ($1, $2, NOW())
       RETURNING id, "wishlistId", "productId", "createdAt"`,
      [wishlistId, productId],
    );

    const itemId = result.rows[0].id;

    // Fetch with product details
    const itemResult = await this.db.query(
      `SELECT wi.id, wi."wishlistId", wi."productId", wi."createdAt",
        p.id, p.name, p.slug, p.sku, p."basePrice", p."isActive",
        (SELECT json_agg(pi ORDER BY pi."sortOrder" ASC) FROM product_images pi WHERE pi."productId" = p.id AND pi."isPrimary" = true) as images
       FROM wishlist_items wi
       JOIN products p ON p.id = wi."productId"
       WHERE wi.id = $1`,
      [itemId],
    );

    return {
      ...itemResult.rows[0],
      product: {
        id: itemResult.rows[0].id,
        name: itemResult.rows[0].name,
        slug: itemResult.rows[0].slug,
        sku: itemResult.rows[0].sku,
        basePrice: itemResult.rows[0].basePrice,
        isActive: itemResult.rows[0].isActive,
        images: itemResult.rows[0].images ? itemResult.rows[0].images : [],
      },
    };
  }

  async removeFromWishlist(userId: string, productId: string) {
    const wishlist = await this.db.query(
      'SELECT id FROM wishlists WHERE "userId" = $1',
      [userId],
    );

    if (wishlist.rows.length === 0) {
      throw new NotFoundException('Wishlist not found');
    }

    const wishlistItem = await this.db.query(
      'SELECT id FROM wishlist_items WHERE "wishlistId" = $1 AND "productId" = $2',
      [wishlist.rows[0].id, productId],
    );

    if (wishlistItem.rows.length === 0) {
      throw new NotFoundException('Wishlist item not found');
    }

    await this.db.query(
      'DELETE FROM wishlist_items WHERE id = $1',
      [wishlistItem.rows[0].id],
    );

    return { id: wishlistItem.rows[0].id };
  }
}
