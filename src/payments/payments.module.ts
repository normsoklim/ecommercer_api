import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { DatabaseModule } from '../database/database.module';
import { BakongGateway } from './gateways/bakong.gateway';

@Module({
  imports: [DatabaseModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, BakongGateway],
  exports: [PaymentsService],
})
export class PaymentsModule {}
