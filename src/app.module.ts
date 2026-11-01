import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { ProductImagesModule } from './product-images/product-images.module';
import { InventoryModule } from './inventory/inventory.module';
import { CartModule } from './cart/cart.module';
import { CheckoutModule } from './checkout/checkout.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';
import { DiscountsModule } from './discounts/discounts.module';
import { ReportsModule } from './reports/reports.module';
import { ReviewsModule } from './reviews/reviews.module';
import { AddressesModule } from './addresses/addresses.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { CsrfModule } from './csrf/csrf.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.development', '.env'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 10,
      },
    ]),
    DatabaseModule,
    MailModule,
    AuthModule,
    CategoriesModule,
    ProductsModule,
    ProductImagesModule,
    InventoryModule,
    CartModule,
    CheckoutModule,
    OrdersModule,
    PaymentsModule,
    RolesModule,
    UsersModule,
    DiscountsModule,
    ReportsModule,
    ReviewsModule,
    AddressesModule,
    WishlistModule,
    CsrfModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
