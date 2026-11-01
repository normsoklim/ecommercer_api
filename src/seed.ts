import { DatabaseService } from './database/database.service';
import { PasswordService } from './auth/password.service';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function seed() {
  const app = await NestFactory.create(AppModule);
  const db = app.get(DatabaseService);
  const passwordService = app.get(PasswordService);
  const config = app.get(ConfigService);

  console.log('Seeding database...');

  // Check if admin user already exists
  const existingAdmin = await db.query(
    "SELECT id FROM users WHERE email = $1",
    ['admin@shopease.com']
  );

  if (existingAdmin.rows.length > 0) {
    console.log('Admin user already exists');
    await app.close();
    return;
  }

  // Create ADMIN role
  const adminRoleResult = await db.query(
    `INSERT INTO roles (name, description, "isActive", "createdAt", "updatedAt")
     VALUES ('ADMIN', 'Administrator with full access', true, NOW(), NOW())
     ON CONFLICT (name) DO NOTHING
     RETURNING id, name`,
  );

  let adminRole = adminRoleResult.rows[0];
  if (!adminRole) {
    const existing = await db.query(
      "SELECT id, name FROM roles WHERE name = 'ADMIN'",
    );
    adminRole = existing.rows[0];
  }

  // Create STAFF role
  const staffRoleResult = await db.query(
    `INSERT INTO roles (name, description, "isActive", "createdAt", "updatedAt")
     VALUES ('STAFF', 'Staff member with limited admin access', true, NOW(), NOW())
     ON CONFLICT (name) DO NOTHING
     RETURNING id, name`,
  );

  let staffRole = staffRoleResult.rows[0];
  if (!staffRole) {
    const existing = await db.query(
      "SELECT id, name FROM roles WHERE name = 'STAFF'",
    );
    staffRole = existing.rows[0];
  }

  // Create admin user
  const passwordHash = await passwordService.hashPassword('Admin123!');

  const adminUserResult = await db.query(
    `INSERT INTO users (email, "passwordHash", "firstName", "lastName", status, "emailVerified", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), NOW())
     RETURNING id, email, "firstName", "lastName"`,
    ['admin@shopease.com', passwordHash, 'Admin', 'User', 'ACTIVE']
  );

  const adminUser = adminUserResult.rows[0];
  console.log('Created admin user:', adminUser.email);

  // Assign ADMIN role to admin user
  await db.query(
    `INSERT INTO user_roles ("userId", "roleId", "createdAt")
     VALUES ($1, $2, NOW())`,
    [adminUser.id, adminRole.id]
  );

  // Create cart and wishlist for admin user
  await db.query(
    `INSERT INTO carts ("userId", "createdAt", "updatedAt")
     VALUES ($1, NOW(), NOW())`,
    [adminUser.id],
  );

  await db.query(
    `INSERT INTO wishlists ("userId", "createdAt", "updatedAt")
     VALUES ($1, NOW(), NOW())`,
    [adminUser.id],
  );

  console.log('Admin user seeded successfully');
  console.log('Email: admin@shopease.com');
  console.log('Password: Admin123!');

  await app.close();
}

seed().catch(console.error);
