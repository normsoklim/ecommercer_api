import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ListReportsDto, ReportGranularity } from './dto/list-reports.dto';

/** Statuses that must not be counted as realised revenue. */
const NON_REVENUE_STATUSES = ['CANCELLED', 'REFUNDED'];

/** Maximum length (in days) of a reporting window. */
const MAX_WINDOW_DAYS = 366;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  shippingAmount: number;
  currency: string;
  createdAt: Date;
  userId: string;
  items: Array<{
    productId: string;
    productName: string;
    productSku: string;
    quantity: number;
    totalPrice: number;
  }>;
}

@Injectable()
export class ReportsService {
  constructor(private db: DatabaseService) {}

  /**
   * Builds the aggregated business report consumed by the admin "Reports"
   * page. Everything is computed server side so the admin app does not have to
   * download every order just to sum it up.
   */
  async getReport(query: ListReportsDto = {}) {
    const { from, to } = this.resolveWindow(query);
    const granularity = query.granularity ?? ReportGranularity.DAY;
    const limit = query.limit ?? 10;

    const [orders, previousOrders] = await Promise.all([
      this.fetchOrders(from, to),
      this.fetchOrders(
        new Date(from.getTime() - (to.getTime() - from.getTime())),
        new Date(from.getTime() - 1),
      ),
    ]);

    const current = this.summarise(orders);
    const previous = this.summarise(previousOrders);

    return {
      period: {
        from: from.toISOString(),
        to: to.toISOString(),
        granularity,
        days: Math.max(
          1,
          Math.round((to.getTime() - from.getTime()) / DAY_IN_MS),
        ),
      },
      summary: {
        ...current,
        revenueChange: this.percentageChange(
          previous.totalRevenue,
          current.totalRevenue,
        ),
        ordersChange: this.percentageChange(
          previous.totalOrders,
          current.totalOrders,
        ),
        averageOrderValueChange: this.percentageChange(
          previous.averageOrderValue,
          current.averageOrderValue,
        ),
      },
      salesOverTime: this.buildSalesOverTime(orders, from, to, granularity),
      orderStatusBreakdown: this.buildStatusBreakdown(orders),
      topProducts: this.buildTopProducts(orders, limit),
      topCustomers: await this.buildTopCustomers(orders, limit),
    };
  }

  /**
   * Resolves the reporting window. It defaults to the last 30 days and
   * rejects windows that are inverted or longer than a year.
   */
  private resolveWindow(query: ListReportsDto): { from: Date; to: Date } {
    const now = new Date();
    const defaultTo = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );
    const defaultFrom = new Date(defaultTo.getTime() - 29 * DAY_IN_MS);

    const from = this.parseBoundary(query.from, defaultFrom, false);
    const to = this.parseBoundary(query.to, defaultTo, true);

    if (from.getTime() > to.getTime()) {
      throw new BadRequestException(
        'The start of the reporting window must be before its end',
      );
    }

    if ((to.getTime() - from.getTime()) / DAY_IN_MS > MAX_WINDOW_DAYS) {
      throw new BadRequestException(
        `The reporting window cannot exceed ${MAX_WINDOW_DAYS} days`,
      );
    }

    return { from, to };
  }

  /**
   * Parses a boundary of the reporting window. A date without a time
   * (`2026-09-30`) covers the whole day: the start of the window is the first
   * millisecond of the day, its end the last one.
   */
  private parseBoundary(
    value: string | undefined,
    fallback: Date,
    endOfDay: boolean,
  ): Date {
    if (!value) {
      return fallback;
    }

    const raw = value.trim();
    const date = new Date(raw);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid reporting window');
    }

    if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return new Date(
        Date.UTC(
          date.getUTCFullYear(),
          date.getUTCMonth(),
          date.getUTCDate(),
          23,
          59,
          59,
          999,
        ),
      );
    }

    return date;
  }

  /** Loads the orders of a window together with their line items. */
  private async fetchOrders(from: Date, to: Date): Promise<OrderRow[]> {
    const result = await this.db.query(
      `SELECT o.id, o."orderNumber", o.status, o."totalAmount", o.subtotal, o."discountAmount", o."taxAmount", o."shippingAmount", o."createdAt", o."userId",
        (SELECT json_agg(json_build_object('productId', oi."productId", 'productName', oi."productName", 'productSku', oi."productSku", 'quantity', oi.quantity, 'totalPrice', oi."totalPrice")) FROM order_items oi WHERE oi."orderId" = o.id) as items
       FROM orders o
       WHERE o."createdAt" >= $1 AND o."createdAt" <= $2
       ORDER BY o."createdAt" ASC`,
      [from, to],
    );

    return result.rows.map((row: any) => ({
      ...row,
      items: row.items || [],
    }));
  }

  /** Computes the headline numbers of a set of orders. */
  private summarise(orders: OrderRow[]) {
    const counted = orders.filter(
      (order) => !NON_REVENUE_STATUSES.includes(order.status),
    );

    const totalRevenue = counted.reduce(
      (sum, order) => sum + (order.totalAmount ?? 0),
      0,
    );
    const grossRevenue = orders.reduce(
      (sum, order) => sum + (order.totalAmount ?? 0),
      0,
    );
    const totalItemsSold = counted.reduce(
      (sum, order) =>
        sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0,
    );
    const totalCustomers = new Set(counted.map((order) => order.userId)).size;

    return {
      totalRevenue,
      grossRevenue,
      totalOrders: orders.length,
      paidOrders: counted.length,
      cancelledOrders: orders.length - counted.length,
      averageOrderValue:
        counted.length > 0 ? Math.round(totalRevenue / counted.length) : 0,
      totalItemsSold,
      totalCustomers,
      totalProductsSold: new Set(
        counted.flatMap((order) => order.items.map((item) => item.productId)),
      ).size,
      currency: orders[0]?.currency ?? 'USD',
    };
  }

  /**
   * Builds the revenue / orders / items series of the reporting window. Empty
   * buckets are kept so the chart does not skip days without orders.
   */
  private buildSalesOverTime(
    orders: OrderRow[],
    from: Date,
    to: Date,
    granularity: ReportGranularity,
  ) {
    const buckets = new Map<
      string,
      { revenue: number; orders: number; items: number }
    >();

    for (const key of this.buildBucketKeys(from, to, granularity)) {
      buckets.set(key, { revenue: 0, orders: 0, items: 0 });
    }

    for (const order of orders) {
      const key = this.bucketKey(order.createdAt, granularity);
      const bucket = buckets.get(key);

      if (!bucket) {
        continue;
      }

      bucket.orders += 1;

      if (!NON_REVENUE_STATUSES.includes(order.status)) {
        bucket.revenue += order.totalAmount ?? 0;
        bucket.items += order.items.reduce(
          (sum, item) => sum + item.quantity,
          0,
        );
      }
    }

    return Array.from(buckets.entries()).map(([key, value]) => ({
      period: key,
      label: this.bucketLabel(key, granularity),
      revenue: value.revenue,
      orders: value.orders,
      items: value.items,
    }));
  }

  /** Counts the orders of the window per status. */
  private buildStatusBreakdown(orders: OrderRow[]) {
    const counts = new Map<string, number>();

    for (const order of orders) {
      counts.set(order.status, (counts.get(order.status) ?? 0) + 1);
    }

    const total = orders.length;

    return Array.from(counts.entries())
      .map(([status, count]) => ({
        status,
        count,
        percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /** Ranks the products by revenue within the reporting window. */
  private buildTopProducts(orders: OrderRow[], limit: number) {
    const products = new Map<
      string,
      {
        productId: string;
        productName: string;
        productSku: string;
        quantitySold: number;
        revenue: number;
        orders: number;
      }
    >();

    for (const order of orders) {
      if (NON_REVENUE_STATUSES.includes(order.status)) {
        continue;
      }

      for (const item of order.items) {
        const entry = products.get(item.productId) ?? {
          productId: item.productId,
          productName: item.productName,
          productSku: item.productSku,
          quantitySold: 0,
          revenue: 0,
          orders: 0,
        };

        entry.quantitySold += item.quantity;
        entry.revenue += item.totalPrice ?? 0;
        entry.orders += 1;

        products.set(item.productId, entry);
      }
    }

    return Array.from(products.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }

  /** Ranks the customers by spend within the reporting window. */
  private async buildTopCustomers(orders: OrderRow[], limit: number) {
    const customers = new Map<
      string,
      { userId: string; orders: number; totalSpent: number }
    >();

    for (const order of orders) {
      if (NON_REVENUE_STATUSES.includes(order.status)) {
        continue;
      }

      const entry = customers.get(order.userId) ?? {
        userId: order.userId,
        orders: 0,
        totalSpent: 0,
      };

      entry.orders += 1;
      entry.totalSpent += order.totalAmount ?? 0;

      customers.set(order.userId, entry);
    }

    const ranked = Array.from(customers.values())
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, limit);

    if (ranked.length === 0) {
      return [];
    }

    const userIds = ranked.map((customer) => customer.userId);
    const users = await this.db.query(
      `SELECT id, email, "firstName", "lastName" FROM users WHERE id = ANY($1)`,
      [userIds],
    );

    const profiles = new Map(users.rows.map((user: any) => [user.id, user]));

    return ranked.map((customer) => {
      const profile = profiles.get(customer.userId);

      return {
        userId: customer.userId,
        email: profile?.email ?? null,
        firstName: profile?.firstName ?? null,
        lastName: profile?.lastName ?? null,
        orders: customer.orders,
        totalSpent: customer.totalSpent,
      };
    });
  }

  /** Lists every bucket key covered by the reporting window. */
  private buildBucketKeys(
    from: Date,
    to: Date,
    granularity: ReportGranularity,
  ): string[] {
    const keys: string[] = [];
    const seen = new Set<string>();
    const cursor = new Date(from.getTime());

    while (cursor.getTime() <= to.getTime()) {
      const key = this.bucketKey(cursor, granularity);

      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return keys;
  }

  /** Computes the bucket a date belongs to. */
  private bucketKey(date: Date, granularity: ReportGranularity): string {
    if (granularity === ReportGranularity.MONTH) {
      return `${date.getUTCFullYear()}-${this.pad(date.getUTCMonth() + 1)}`;
    }

    if (granularity === ReportGranularity.WEEK) {
      return this.toDayKey(this.startOfWeek(date));
    }

    return this.toDayKey(date);
  }

  /** Human readable label of a bucket key. */
  private bucketLabel(key: string, granularity: ReportGranularity): string {
    if (granularity === ReportGranularity.MONTH) {
      const [year, month] = key.split('-').map(Number);
      return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(
        'en-US',
        {
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        },
      );
    }

    const [year, month, day] = key.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(
      'en-US',
      {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      },
    );
  }

  /** Monday of the week the date belongs to. */
  private startOfWeek(date: Date): Date {
    const start = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    const weekday = (start.getUTCDay() + 6) % 7;

    start.setUTCDate(start.getUTCDate() - weekday);

    return start;
  }

  /** `YYYY-MM-DD` representation of a date (UTC). */
  private toDayKey(date: Date): string {
    return `${date.getUTCFullYear()}-${this.pad(date.getUTCMonth() + 1)}-${this.pad(
      date.getUTCDate(),
    )}`;
  }

  private pad(value: number): string {
    return String(value).padStart(2, '0');
  }

  /** Percentage difference between two values. */
  private percentageChange(previous: number, current: number): number {
    if (previous === 0) {
      return current === 0 ? 0 : 100;
    }

    return Math.round(((current - previous) / previous) * 1000) / 10;
  }
}
