import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Pool, PoolClient, QueryResult } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;

  constructor() {
    const connectionString = `postgres://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`;
    this.pool = new Pool({
      connectionString,
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      database: process.env.DB_DATABASE,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,  
    });
  }

  async onModuleInit() {
    try {
      await this.pool.connect();
      this.logger.log('Database connected');
      await this.ensureSchema();
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  /**
   * Ensures all tables required by the application exist. Idempotent and safe
   * to run on every startup. This is necessary because the application uses
   * raw `pg` queries without an ORM or migration system, so the schema must be
   * provisioned before any service attempts to query it.
   */
  private async ensureSchema() {
    const statements = [
      `CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        "passwordHash" TEXT NOT NULL,
        "firstName" TEXT NOT NULL,
        "lastName" TEXT NOT NULL,
        phone TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
        "emailVerified" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS user_roles (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "roleId" INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE("userId", "roleId")
      )`,
      `CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        "refreshToken" TEXT NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "lastActivityAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS "ipAddress" TEXT`,
      `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS "userAgent" TEXT`,
      `CREATE TABLE IF NOT EXISTS carts (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS wishlists (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        description TEXT,
        "parentId" INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        "imageUrl" TEXT,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        sku TEXT NOT NULL UNIQUE,
        "categoryId" INTEGER NOT NULL REFERENCES categories(id),
        description TEXT,
        "shortDescription" TEXT,
        "basePrice" INTEGER NOT NULL DEFAULT 0,
        "compareAtPrice" INTEGER,
        weight INTEGER,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "isFeatured" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS product_variants (
        id SERIAL PRIMARY KEY,
        "productId" INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        "priceAdjustment" INTEGER NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS product_images (
        id SERIAL PRIMARY KEY,
        "productId" INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        "altText" TEXT,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "isPrimary" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS inventory (
        id SERIAL PRIMARY KEY,
        "productId" INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        "variantId" INTEGER REFERENCES product_variants(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 0,
        "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS inventory_movements (
        id SERIAL PRIMARY KEY,
        "inventoryId" INTEGER NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        "referenceId" TEXT,
        "referenceType" TEXT,
        notes TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS cart_items (
        id SERIAL PRIMARY KEY,
        "cartId" INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
        "productId" INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        "variantId" INTEGER REFERENCES product_variants(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 1,
        "unitPrice" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS wishlist_items (
        id SERIAL PRIMARY KEY,
        "wishlistId" INTEGER NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
        "productId" INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        "orderNumber" TEXT NOT NULL UNIQUE,
        "userId" INTEGER NOT NULL REFERENCES users(id),
        status TEXT NOT NULL DEFAULT 'PENDING',
        subtotal INTEGER NOT NULL DEFAULT 0,
        "discountAmount" INTEGER NOT NULL DEFAULT 0,
        "taxAmount" INTEGER NOT NULL DEFAULT 0,
        "shippingAmount" INTEGER NOT NULL DEFAULT 0,
        "totalAmount" INTEGER NOT NULL DEFAULT 0,
        "idempotencyKey" TEXT,
        "shippedAt" TIMESTAMP,
        "deliveredAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        "orderId" INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        "productId" INTEGER NOT NULL REFERENCES products(id),
        "variantId" INTEGER REFERENCES product_variants(id),
        "productName" TEXT NOT NULL,
        "productSku" TEXT NOT NULL,
        "variantName" TEXT,
        quantity INTEGER NOT NULL DEFAULT 1,
        "unitPrice" INTEGER NOT NULL DEFAULT 0,
        "totalPrice" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        "orderId" INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        amount INTEGER NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'USD',
        "idempotencyKey" TEXT,
        "providerPaymentId" TEXT,
        "qrString" TEXT,
        "transactionMd5" TEXT,
        "expiresAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS payment_transactions (
        id SERIAL PRIMARY KEY,
        "paymentId" INTEGER NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        amount INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        "providerTransactionId" TEXT,
        "rawResponse" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS refunds (
        id SERIAL PRIMARY KEY,
        "paymentId" INTEGER NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL DEFAULT 0,
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS shipments (
        id SERIAL PRIMARY KEY,
        "orderId" INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        "trackingNumber" TEXT,
        carrier TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        "shippedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS coupons (
        id SERIAL PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        value INTEGER NOT NULL DEFAULT 0,
        "min_order_amount" INTEGER,
        "max_discount_amount" INTEGER,
        "usage_limit" INTEGER,
        "starts_at" TIMESTAMP NOT NULL,
        "expires_at" TIMESTAMP NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        "productId" INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL,
        title TEXT,
        comment TEXT,
        "isVerifiedPurchase" BOOLEAN NOT NULL DEFAULT false,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS customer_addresses (
        id SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        label TEXT,
        "recipient_phone" TEXT,
        "address_line" TEXT,
        "formatted_address" TEXT,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        "place_id" TEXT,
        "isDefault" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS addresses (
        id SERIAL PRIMARY KEY,
        "orderId" INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        "firstName" TEXT NOT NULL,
        "lastName" TEXT NOT NULL,
        company TEXT,
        "addressLine1" TEXT NOT NULL,
        phone TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS verification_codes (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        purpose TEXT NOT NULL,
        "codeHash" TEXT NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "consumedAt" TIMESTAMP,
        attempts INTEGER NOT NULL DEFAULT 0
      )`,
      `ALTER TABLE customer_addresses DROP COLUMN IF EXISTS city`,
      `ALTER TABLE customer_addresses DROP COLUMN IF EXISTS country`,
      `ALTER TABLE customer_addresses DROP COLUMN IF EXISTS "postal_code"`,
      `ALTER TABLE addresses DROP COLUMN IF EXISTS "addressLine2"`,
      `ALTER TABLE addresses DROP COLUMN IF EXISTS city`,
      `ALTER TABLE addresses DROP COLUMN IF EXISTS state`,
      `ALTER TABLE addresses DROP COLUMN IF EXISTS "postalCode"`,
      `ALTER TABLE addresses DROP COLUMN IF EXISTS country`,
    ];

    for (const sql of statements) {
      await this.pool.query(sql);
    }

    this.logger.log('Database schema ensured');
  }

  async onModuleDestroy() {
    await this.pool.end();
    this.logger.log('Database disconnected');
  }

  /**
   * Execute a SQL query with parameters.
   */
  async query(text: string, params?: unknown[]): Promise<QueryResult> {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      this.logger.debug(`Executed query in ${duration}ms`, { text: text.substring(0, 100) });
      return result;
    } catch (error) {
      this.logger.error('Query error', { text: text.substring(0, 100), error });
      throw error;
    }
  }

  /**
   * Get a client from the pool for transactions.
   */
  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  /**
   * Execute a query within a transaction using a client.
   */
  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
