import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Injectable()
export class CartService {
  constructor(private db: DatabaseService) {}

  async getCart(userId: string) {
    let cart = await this.db.query(
      'SELECT id, "userId", "createdAt", "updatedAt" FROM carts WHERE "userId" = $1',
      [userId],
    );

    if (cart.rows.length === 0) {
      const createResult = await this.db.query(
        `INSERT INTO carts ("userId", "createdAt", "updatedAt")
         VALUES ($1, NOW(), NOW())
         RETURNING id, "userId", "createdAt", "updatedAt"`,
        [userId],
      );
      cart = createResult;
    }

    const cartId = cart.rows[0].id;

    const itemsResult = await this.db.query(
      `SELECT ci.id, ci."cartId", ci."productId", ci."variantId", ci.quantity, ci."unitPrice", ci."createdAt",
        p.id, p.name, p.slug, p.sku, p."basePrice",
        (SELECT json_agg(pi ORDER BY pi."sortOrder" ASC) FROM product_images pi WHERE pi."productId" = p.id AND pi."isPrimary" = true LIMIT 1) as images,
        v.id as "variantId", v.name as variant_name, v."priceAdjustment" as variant_price_adjustment,
        i.quantity as inventory_quantity, i."reservedQuantity" as inventory_reserved
       FROM cart_items ci
       JOIN products p ON p.id = ci."productId"
       LEFT JOIN product_variants v ON v.id = ci."variantId"
       LEFT JOIN inventory i ON i."productId" = p.id AND i."variantId" = ci."variantId"
       WHERE ci."cartId" = $1
       ORDER BY ci."createdAt" ASC`,
      [cartId],
    );

    return {
      ...cart.rows[0],
      items: itemsResult.rows.map((row) => ({
        id: row.id,
        cartId: row.cartId,
        productId: row.productId,
        variantId: row.variantId,
        quantity: row.quantity,
        unitPrice: row.unitPrice,
        createdAt: row.createdAt,
        product: {
          id: row.id,
          name: row.name,
          slug: row.slug,
          sku: row.sku,
          basePrice: row.basePrice,
          images: row.images ? row.images : [],
        },
        variant: row.variantId
          ? {
              id: row.variantId,
              name: row.variant_name,
              priceAdjustment: row.variant_price_adjustment,
            }
          : null,
        inventory: row.inventory_quantity !== undefined
          ? {
              quantity: row.inventory_quantity,
              reservedQuantity: row.inventory_reserved,
            }
          : null,
      })),
    };
  }

  async addToCart(userId: string, addToCartDto: AddToCartDto) {
    const { productId, variantId, quantity } = addToCartDto;

    // Validate the product
    const productResult = await this.db.query(
      `SELECT p.id, p."basePrice", p."isActive",
        v.id as "variantId", v."isActive" as variant_is_active, v."priceAdjustment" as variant_price_adjustment, v.name as variant_name,
        i.quantity as inventory_quantity, i."reservedQuantity" as inventory_reserved
       FROM products p
       LEFT JOIN product_variants v ON v.id = $2 AND v."productId" = p.id
       LEFT JOIN inventory i ON i."productId" = p.id AND i."variantId" = $2
       WHERE p.id = $1`,
      [productId, variantId ?? null],
    );

    if (productResult.rows.length === 0 || !productResult.rows[0].isActive) {
      throw new NotFoundException('Product not found');
    }

    const product = productResult.rows[0];

    let effectivePrice = product.basePrice;
    let variantName: string | undefined;

    if (variantId) {
      const variant = product.variantId;
      if (!variant || !product.variant_is_active) {
        throw new NotFoundException('Product variant not found');
      }
      effectivePrice = product.basePrice + (product.variant_price_adjustment ?? 0);
      variantName = product.variant_name;
    }

    // Persist the cart and cart item atomically in a single transaction.
    return this.db.transaction(async (client) => {
      // Find the existing cart for the user or create one.
      // NOTE: We do not use ON CONFLICT here because the carts table has no
      // UNIQUE constraint on "userId" (see DatabaseService.ensureSchema).
      // Using ON CONFLICT without a matching constraint throws a 500 error.
      const cartResult = await client.query(
        `SELECT id FROM carts WHERE "userId" = $1`,
        [userId],
      );

      let cartId: number;

      if (cartResult.rows.length === 0) {
        const createResult = await client.query(
          `INSERT INTO carts ("userId", "createdAt", "updatedAt")
           VALUES ($1, NOW(), NOW())
           RETURNING id`,
          [userId],
        );
        cartId = createResult.rows[0].id;
      } else {
        cartId = cartResult.rows[0].id;
        await client.query(
          `UPDATE carts SET "updatedAt" = NOW() WHERE id = $1`,
          [cartId],
        );
      }

      // Check whether the same product + variant is already in the cart.
      const existingItem = await client.query(
        `SELECT id, quantity FROM cart_items WHERE "cartId" = $1 AND "productId" = $2 AND "variantId" = $3`,
        [cartId, productId, variantId ?? null],
      );

      if (existingItem.rows.length > 0) {
        const updateResult = await client.query(
          `UPDATE cart_items SET quantity = $1, "unitPrice" = $2 WHERE id = $3 RETURNING id, "cartId", "productId", "variantId", quantity, "unitPrice", "createdAt"`,
          [existingItem.rows[0].quantity + quantity, effectivePrice, existingItem.rows[0].id],
        );

        return {
          ...updateResult.rows[0],
          product: {
            id: product.id,
            name: product.name,
            slug: product.slug,
            sku: product.sku,
            basePrice: product.basePrice,
            images: [],
          },
          variant: variantId
            ? {
                id: product.variantId,
                name: product.variant_name,
                priceAdjustment: product.variant_price_adjustment,
              }
            : null,
        };
      }

      const createResult = await client.query(
        `INSERT INTO cart_items ("cartId", "productId", "variantId", quantity, "unitPrice", "createdAt")
         VALUES ($1, $2, $3, $4, $5, NOW())
         RETURNING id, "cartId", "productId", "variantId", quantity, "unitPrice", "createdAt"`,
        [cartId, productId, variantId ?? null, quantity, effectivePrice],
      );

      return {
        ...createResult.rows[0],
        product: {
          id: product.id,
          name: product.name,
          slug: product.slug,
          sku: product.sku,
          basePrice: product.basePrice,
          images: [],
        },
        variant: variantId
          ? {
              id: product.variantId,
              name: product.variant_name,
              priceAdjustment: product.variant_price_adjustment,
            }
          : null,
      };
    });
  }

  async updateCartItem(
    userId: string,
    itemId: string,
    updateCartItemDto: UpdateCartItemDto,
  ) {
    const { quantity } = updateCartItemDto;

    const cart = await this.db.query(
      'SELECT id FROM carts WHERE "userId" = $1',
      [userId],
    );

    if (cart.rows.length === 0) {
      throw new NotFoundException('Cart not found');
    }

    const cartItem = await this.db.query(
      `SELECT ci.id, ci."cartId", ci."productId", ci."variantId", ci.quantity,
        p.id, p.name, p.slug, p.sku, p."basePrice",
        (SELECT json_agg(pi ORDER BY pi."sortOrder" ASC) FROM product_images pi WHERE pi."productId" = p.id AND pi."isPrimary" = true LIMIT 1) as images
       FROM cart_items ci
       JOIN products p ON p.id = ci."productId"
       WHERE ci.id = $1 AND ci."cartId" = $2`,
      [itemId, cart.rows[0].id],
    );

    if (cartItem.rows.length === 0) {
      throw new NotFoundException('Cart item not found');
    }

    if (quantity <= 0) {
      await this.db.query('DELETE FROM cart_items WHERE id = $1', [itemId]);
      return { id: itemId };
    }

    const result = await this.db.query(
      `UPDATE cart_items SET quantity = $1 WHERE id = $2 RETURNING id, "cartId", "productId", "variantId", quantity, "unitPrice", "createdAt"`,
      [quantity, itemId],
    );

    return {
      ...result.rows[0],
      product: {
        id: cartItem.rows[0].id,
        name: cartItem.rows[0].name,
        slug: cartItem.rows[0].slug,
        sku: cartItem.rows[0].sku,
        basePrice: cartItem.rows[0].basePrice,
        images: cartItem.rows[0].images ? cartItem.rows[0].images : [],
      },
      variant: null,
    };
  }

  async removeFromCart(userId: string, itemId: string) {
    const cart = await this.db.query(
      'SELECT id FROM carts WHERE "userId" = $1',
      [userId],
    );

    if (cart.rows.length === 0) {
      throw new NotFoundException('Cart not found');
    }

    await this.db.query('DELETE FROM cart_items WHERE id = $1', [itemId]);

    return { id: itemId };
  }

  async clearCart(userId: string) {
    const cart = await this.db.query(
      'SELECT id FROM carts WHERE "userId" = $1',
      [userId],
    );

    if (cart.rows.length === 0) {
      return { message: 'Cart is already empty' };
    }

    await this.db.query('DELETE FROM cart_items WHERE "cartId" = $1', [
      cart.rows[0].id,
    ]);

    return { message: 'Cart cleared' };
  }
}
