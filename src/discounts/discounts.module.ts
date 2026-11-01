import { Module } from '@nestjs/common';
import { DiscountsService } from './discounts.service';
import { DiscountsController } from './discounts.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [DiscountsController],
  providers: [DiscountsService],
  exports: [DiscountsService],
})
export class DiscountsModule {}
