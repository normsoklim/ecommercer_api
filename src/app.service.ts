import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from './database/database.service';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly db: DatabaseService) {}

  getHello(): string {
    return 'Hello World!';
  }

  getHealth(): Record<string, unknown> {
    return {
      status: 'ok',
      service: 'e-commerce-api',
      timestamp: new Date().toISOString(),
      docs: '/docs',
    };
  }

  async getDatabaseHealth(): Promise<Record<string, unknown>> {
    try {
      await this.db.query('SELECT 1');

      return {
        status: 'ok',
        database: 'connected',
        message: 'Database connection is healthy.',
      };
    } catch (error) {
      this.logger.error('Database health check failed', error);

      return {
        status: 'degraded',
        database: 'disconnected',
        message: 'Unable to reach the database.',
      };
    }
  }
}
