import { Module } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { DatabaseModule } from '../database/database.module';
import { SecurityModule } from '../common/security/security.module';

@Module({
  imports: [DatabaseModule, SecurityModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
