import { Module } from '@nestjs/common';
import { XssService } from './xss.service';

@Module({
  providers: [XssService],
  exports: [XssService],
})
export class SecurityModule {}
