import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { doubleCsrfProtection } from './csrf/csrf.util';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Trust proxy so that req.ip, req.secure and X-Forwarded-Proto are
  // correctly resolved when the API sits behind a reverse proxy/load balancer.
  // This is required for the Secure cookie flag to work correctly in production.
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', true);

  // Register Helmet early so security headers apply to all routes.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
        },
      },
      // Prevent MIME-type sniffing.
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'same-origin' },
      // Strict-Transport-Security: enforce HTTPS for 1 year (include subdomains).
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      // Referrer-Policy: do not send referrer headers to external sites.
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      // X-Content-Type-Options: nosniff is set by default by helmet.
      // X-Frame-Options: DENY is set by default by helmet (frameAncestors: 'none').
    }),
  );

  // Add Cache-Control: no-store to all responses so sensitive authenticated
  // data is not cached by browsers or intermediate proxies.
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  app.use(cookieParser());

  app.use((req, res, next) => {
    if (req.path === '/api/v1/csrf/token' && req.method === 'GET') {
      return next();
    }
    if (process.env.NODE_ENV !== 'production') {
      return next();
    }
    return doubleCsrfProtection(req, res, next);
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global exception filter: catches all unhandled exceptions and returns
  // a structured error response instead of a generic 500 Internal Server Error.
  app.useGlobalFilters(new HttpExceptionFilter());

  const corsOrigins = (
    process.env.CORS_ORIGIN ?? 'http://localhost:3000,http://localhost:3002,http://localhost:3001'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token',
      'X-Requested-With',
    ],
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 3001);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('E-commerce Platform API')
    .setDescription(
      'REST API for the e-commerce platform: authentication, catalog (categories & products), inventory, cart, checkout, orders and payments.',
    )
    .setVersion('1.0.0')
    .addServer(`http://localhost:${port}`, 'Local')
    .addServer(
      process.env.API_URL ?? `http://localhost:${port}`,
      'Configured server',
    )
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'access-token',
    )
    .addTag('auth', 'Authentication & user profile')
    .addTag('categories', 'Product categories')
    .addTag('products', 'Catalog products')
    .addTag('product-images', 'Product images and galleries')
    .addTag('inventory', 'Stock levels and movements')
    .addTag('cart', 'Shopping cart')
    .addTag('checkout', 'Checkout')
    .addTag('orders', 'Orders')
    .addTag('payments', 'Payments & refunds')
    .addTag('roles', 'Roles and role assignments')
    .addTag('users', 'Users and their roles')
    .addTag('discounts', 'Discount codes and coupons')
    .addTag('reports', 'Business reports and analytics')
    .addTag('reviews', 'Product reviews')
    .addTag('addresses', 'Customer delivery addresses')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true, tagsSorter: 'alpha' },
    customSiteTitle: 'E-commerce Platform API Docs',
  });

  await app.listen(port);

  console.log(
    `API listening on http://localhost:${port} — Swagger UI available at http://localhost:${port}/docs`,
  );
}

void bootstrap();
