import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_DATABASE || 'ecommerce_db',
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'admin123',
});

// Sample product image URLs (using Unsplash for demo purposes)
const SAMPLE_IMAGES = [
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80',
  'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800&q=80',
  'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=800&q=80',
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80',
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
  'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&q=80',
  'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=800&q=80',
  'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=800&q=80',
];

async function removeSeededImages() {
  console.log('Removing seeded product images...');

  try {
    // Delete all product images
    const result = await pool.query(
      'DELETE FROM product_images'
    );

    console.log(`Successfully removed ${result.rowCount || 0} product images`);
  } catch (error) {
    console.error('Error removing product images:', error);
  } finally {
    await pool.end();
  }
}

removeSeededImages();
