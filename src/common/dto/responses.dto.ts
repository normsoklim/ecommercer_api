import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CategoryResponseDto {
  @ApiProperty({ example: '0f0d2a1c-6c1a-4a53-9d1a-2f1d3c4b5a6e' })
  id: string;

  @ApiProperty({ example: 'Electronics' })
  name: string;

  @ApiProperty({ example: 'electronics' })
  slug: string;

  @ApiPropertyOptional({
    example: 'All electronic devices and accessories',
    nullable: true,
  })
  description?: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  parentId?: string | null;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/electronics.png',
    nullable: true,
  })
  imageUrl?: string | null;

  @ApiProperty({ example: 0 })
  sortOrder: number;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  updatedAt: string;
}

export class ReviewResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d' })
  id: string;

  @ApiProperty({ example: '3d1a2b3c-4d5e-6f70-8192-a3b4c5d6e7f8' })
  productId: string;

  @ApiProperty({ example: '7c9e6679-7425-40de-944b-e07fc1f90ae7' })
  userId: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  rating: number;

  @ApiPropertyOptional({
    example: 'Excellent noise cancelling',
    nullable: true,
  })
  title?: string | null;

  @ApiPropertyOptional({
    example: 'The battery lasts more than a week with ANC enabled.',
    nullable: true,
  })
  comment?: string | null;

  @ApiProperty({
    example: true,
    description: 'True when the customer actually bought the product',
  })
  isVerifiedPurchase: boolean;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'The product the review belongs to',
  })
  product?: {
    id: string;
    name: string;
    slug: string;
    sku: string;
  } | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'The author of the review',
  })
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  updatedAt: string;
}

export class ProductImageResponseDto {
  @ApiProperty({ example: '9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d' })
  id: string;

  @ApiProperty({ example: '3d1a2b3c-4d5e-6f70-8192-a3b4c5d6e7f8' })
  productId: string;

  @ApiProperty({
    example: 'https://cdn.example.com/products/headphones-front.png',
  })
  url: string;

  @ApiPropertyOptional({
    example: 'Front view of the wireless headphones',
    nullable: true,
  })
  altText?: string | null;

  @ApiProperty({ example: 0 })
  sortOrder: number;

  @ApiProperty({ example: true })
  isPrimary: boolean;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'The product the image belongs to',
  })
  product?: {
    id: string;
    name: string;
    slug: string;
    sku: string;
  } | null;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  createdAt: string;
}

export class ProductResponseDto {
  @ApiProperty({ example: '3d1a2b3c-4d5e-6f70-8192-a3b4c5d6e7f8' })
  id: string;

  @ApiProperty({ example: '0f0d2a1c-6c1a-4a53-9d1a-2f1d3c4b5a6e' })
  categoryId: string;

  @ApiProperty({ example: 'Wireless Headphones' })
  name: string;

  @ApiProperty({ example: 'wireless-headphones' })
  slug: string;

  @ApiProperty({ example: 'WH-1000XM5', uniqueItems: true })
  sku: string;

  @ApiPropertyOptional({
    example: 'Over-ear noise cancelling headphones',
    nullable: true,
  })
  description?: string | null;

  @ApiPropertyOptional({
    example: 'Premium over-ear headphones',
    nullable: true,
  })
  shortDescription?: string | null;

  @ApiProperty({
    example: 29900,
    description: 'Base price in minor units (cents)',
  })
  basePrice: number;

  @ApiPropertyOptional({
    example: 34900,
    nullable: true,
    description: 'Compare-at price in minor units',
  })
  compareAtPrice?: number | null;

  @ApiPropertyOptional({
    example: 0.35,
    nullable: true,
    description: 'Weight in kilograms',
  })
  weight?: number | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: false })
  isFeatured: boolean;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  dimensions?: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: CategoryResponseDto, nullable: true })
  category?: CategoryResponseDto | null;

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  images?: ProductImageResponseDto[];

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  variants?: Array<Record<string, unknown>>;

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  inventory?: Array<Record<string, unknown>>;

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  reviews?: Array<Record<string, unknown>>;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  updatedAt: string;
}

export class UserResponseDto {
  @ApiProperty({ example: '7c9e6679-7425-40de-944b-e07fc1f90ae7' })
  id: string;

  @ApiProperty({ example: 'customer@example.com' })
  email: string;

  @ApiProperty({ example: 'Jane' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  lastName: string;

  @ApiPropertyOptional({ example: '+6612345678', nullable: true })
  phone?: string | null;

  @ApiProperty({
    example: 'ACTIVE',
    enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION'],
  })
  status: string;

  @ApiPropertyOptional({
    example: '2026-01-01T00:00:00.000Z',
    nullable: true,
    description:
      'Timestamp of the email verification, null while the address is unverified',
  })
  emailVerified?: string | null;

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'string' },
    example: ['CUSTOMER'],
  })
  roles?: string[];

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  updatedAt: string;
}

export class RegisterResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;

  @ApiProperty({
    example: true,
    description:
      'True when the account still has to confirm its email address with a one-time code',
  })
  requiresVerification: boolean;

  @ApiProperty({ example: 'customer@example.com' })
  email: string;

  @ApiProperty({
    example: 600,
    description: 'Lifetime of the one-time code in seconds',
  })
  expiresInSeconds: number;
}

export class RoleResponseDto {
  @ApiProperty({ example: '7c9e6679-7425-40de-944b-e07fc1f90ae7' })
  id: string;

  @ApiProperty({ example: 'ADMIN' })
  name: string;

  @ApiPropertyOptional({
    example: 'Full access to the administration panel',
    nullable: true,
  })
  description?: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiPropertyOptional({
    example: 3,
    description: 'Number of users currently holding this role',
  })
  userCount?: number;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  updatedAt: string;
}

export class UserRoleResponseDto {
  @ApiProperty({ example: '3d1a2b3c-4d5e-6f70-8192-a3b4c5d6e7f8' })
  id: string;

  @ApiProperty({ example: '7c9e6679-7425-40de-944b-e07fc1f90ae7' })
  userId: string;

  @ApiProperty({ example: '0f0d2a1c-6c1a-4a53-9d1a-2f1d3c4b5a6e' })
  roleId: string;

  @ApiProperty({ type: RoleResponseDto })
  role: RoleResponseDto;

  @ApiPropertyOptional({ type: UserResponseDto, nullable: true })
  user?: UserResponseDto | null;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  createdAt: string;
}

export class DiscountResponseDto {
  @ApiProperty({ example: '3d1a2b3c-4d5e-6f70-8192-a3b4c5d6e7f8' })
  id: string;

  @ApiProperty({ example: 'SUMMER2024' })
  code: string;

  @ApiProperty({ example: 'PERCENTAGE', enum: ['PERCENTAGE', 'FIXED_AMOUNT'] })
  type: string;

  @ApiProperty({
    example: 20,
    description:
      'Percentage points for PERCENTAGE discounts, otherwise an amount in minor units (cents)',
  })
  value: number;

  @ApiPropertyOptional({
    example: 10000,
    nullable: true,
    description: 'Minimum order amount in minor units (cents)',
  })
  minOrderAmount?: number | null;

  @ApiPropertyOptional({
    example: 5000,
    nullable: true,
    description: 'Maximum discount amount in minor units (cents)',
  })
  maxDiscountAmount?: number | null;

  @ApiPropertyOptional({
    example: 1000,
    nullable: true,
    description: 'Maximum number of times the code can be used',
  })
  usageLimit?: number | null;

  @ApiProperty({ example: 3, description: 'Number of times the code was used' })
  usageCount: number;

  @ApiProperty({ example: '2026-06-01T00:00:00.000Z' })
  startsAt: string;

  @ApiProperty({ example: '2026-08-31T23:59:59.000Z' })
  expiresAt: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  updatedAt: string;
}

export class AuthTokensDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refreshToken: string;
}

export class AuthResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refreshToken: string;

  @ApiPropertyOptional({
    example: false,
    description: 'True when the client asked to keep the session alive',
  })
  rememberMe?: boolean;

  @ApiPropertyOptional({
    example: 900000,
    description: 'Lifetime of the access token in milliseconds',
  })
  expiresInMs?: number;
}

export class TokenPairDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refreshToken: string;

  @ApiPropertyOptional({
    example: false,
    description: 'True when the session is a remembered one',
  })
  rememberMe?: boolean;
}
