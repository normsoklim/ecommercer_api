import { Module } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { CheckoutController } from './checkout.controller';
import { DatabaseModule } from '../database/database.module';
import { CartModule } from '../cart/cart.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [DatabaseModule, CartModule, InventoryModule],
  controllers: [CheckoutController],
  providers: [CheckoutService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
