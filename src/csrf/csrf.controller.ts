import {
  Controller,
  Get,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { generateCsrfToken } from './csrf.util';

@Controller('csrf')
export class CsrfController {
  /**
   * Returns a CSRF token and sets the csrf-token HttpOnly cookie. The
   * frontend should call this endpoint before making state-changing requests
   * and include the returned token in the X-CSRF-Token header.
   */
  @Get('token')
  @HttpCode(HttpStatus.OK)
  async getCsrfToken(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = generateCsrfToken(req, res);
    return { csrfToken: token };
  }
}
