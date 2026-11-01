import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  getRequest(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    return request;
  }
}
