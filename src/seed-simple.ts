import { Pool } from 'pg';
import * as argon2 from 'argon2';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_DATABASE || 'ecommerce_db',
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'admin123',
});

async function seed() {
  console.log('Seeding database...');

  // Check if admin user already exists
  const existingAdmin = await pool.query(
    "SELECT id FROM users WHERE email = $1",
    ['admin@shopease.com']
  );

  if (existingAdmin.rows.length > 0) {
    console.log('Admin user already exists');
    await pool.end();
    return;
  }

  // Create ADMIN role
  const adminRoleResult = await pool.query(
    `INSERT INTO roles (name, description, "isActive", "createdAt", "updatedAt")
     VALUES ('ADMIN', 'Administrator with full access', true, NOW(), NOW())
     ON CONFLICT (name) DO NOTHING
     RETURNING id, name`,
  );

  let adminRole = adminRoleResult.rows[0];
  if (!adminRole) {
    const existing = await pool.query(
      "SELECT id, name FROM roles WHERE name = 'ADMIN'",
    );
    adminRole = existing.rows[0];
  }

  // Create STAFF role
  const staffRoleResult = await pool.query(
    `INSERT INTO roles (name, description, "isActive", "createdAt", "updatedAt")
     VALUES ('STAFF', 'Staff member with limited admin access', true, NOW(), NOW())
     ON CONFLICT (name) DO NOTHING
     RETURNING id, name`,
  );

  let staffRole = staffRoleResult.rows[0];
  if (!staffRole) {
    const existing = await pool.query(
      "SELECT id, name FROM roles WHERE name = 'STAFF'",
    );
    staffRole = existing.rows[0];
  }

  // Create admin user
  const passwordHash = await argon2.hash('Admin123!');

  const adminUserResult = await pool.query(
    `INSERT INTO users (email, "passwordHash", "firstName", "lastName", status, "emailVerified", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), NOW())
     RETURNING id, email, "firstName", "lastName"`,
    ['admin@shopease.com', passwordHash, 'Admin', 'User', 'ACTIVE']
  );

  const adminUser = adminUserResult.rows[0];
  console.log('Created admin user:', adminUser.email);

  // Assign ADMIN role to admin user
  await pool.query(
    `INSERT INTO user_roles ("userId", "roleId", "createdAt")
     VALUES ($1, $2, NOW())`,
    [adminUser.id, adminRole.id]
  );

  // Create cart and wishlist for admin user
  await pool.query(
    `INSERT INTO carts ("userId", "createdAt", "updatedAt")
     VALUES ($1, NOW(), NOW())`,
    [adminUser.id],
  );

  await pool.query(
    `INSERT INTO wishlists ("userId", "createdAt", "updatedAt")
     VALUES ($1, NOW(), NOW())`,
    [adminUser.id],
  );

  console.log('Admin user seeded successfully');
  console.log('Email: admin@shopease.com');
  console.log('Password: Admin123!');

  await pool.end();
}

seed().catch(console.error);
