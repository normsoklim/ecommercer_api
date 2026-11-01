import { Module } from '@nestjs/common';
import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [AddressesController],
  providers: [AddressesService],
})
export class AddressesModule {}
