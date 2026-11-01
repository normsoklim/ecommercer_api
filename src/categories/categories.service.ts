import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private db: DatabaseService) {}

  async create(createCategoryDto: CreateCategoryDto) {
    const { name, slug, description, parentId, imageUrl, sortOrder, isActive } =
      createCategoryDto;

    const existingSlug = await this.db.query(
      'SELECT id FROM categories WHERE slug = $1',
      [slug],
    );

    if (existingSlug.rows.length > 0) {
      throw new ConflictException('Category with this slug already exists');
    }

    if (parentId) {
      const parent = await this.db.query(
        'SELECT id FROM categories WHERE id = $1',
        [parentId],
      );
      if (parent.rows.length === 0) {
        throw new NotFoundException('Parent category not found');
      }
    }

    const result = await this.db.query(
      `INSERT INTO categories (name, slug, description, "parentId", "imageUrl", "sortOrder", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING id, name, slug, description, "parentId", "imageUrl", "sortOrder", "isActive", "createdAt", "updatedAt"`,
      [name, slug, description, parentId, imageUrl, sortOrder, isActive],
    );

    const category = result.rows[0];

    // Fetch parent, children, and product count
    const [parentResult, childrenResult, countResult] = await Promise.all([
      parentId
        ? this.db.query(
            'SELECT id, name, slug FROM categories WHERE id = $1',
            [parentId],
          )
        : Promise.resolve({ rows: [null] }),
      this.db.query(
        'SELECT id, name, slug FROM categories WHERE "parentId" = $1 AND "isActive" = true ORDER BY "sortOrder" ASC',
        [category.id],
      ),
      this.db.query(
        'SELECT COUNT(*) FROM products WHERE "categoryId" = $1',
        [category.id],
      ),
    ]);

    return {
      ...category,
      parent: parentResult.rows[0] ?? null,
      children: childrenResult.rows,
      _count: { products: parseInt(countResult.rows[0].count, 10) },
    };
  }

  async findAll() {
    const result = await this.db.query(
      `SELECT c.*, 
        (SELECT COUNT(*) FROM products p WHERE p."categoryId" = c.id) as product_count
       FROM categories c 
       WHERE c."isActive" = true 
       ORDER BY c."sortOrder" ASC`,
    );

    // Fetch children for each category
    const categories = result.rows;
    for (const category of categories) {
      const childrenResult = await this.db.query(
        'SELECT id, name, slug FROM categories WHERE "parentId" = $1 AND "isActive" = true ORDER BY "sortOrder" ASC',
        [category.id],
      );
      category.children = childrenResult.rows;
      category._count = { products: parseInt(category.product_count, 10) };
      delete category.product_count;
    }

    return categories;
  }

  async findOne(id: string) {
    const result = await this.db.query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM products p WHERE p."categoryId" = c.id) as product_count
       FROM categories c 
       WHERE c.id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Category not found');
    }

    const category = result.rows[0];

    // Fetch parent
    let parent = null;
    if (category.parentId) {
      const parentResult = await this.db.query(
        'SELECT id, name, slug FROM categories WHERE id = $1',
        [category.parentId],
      );
      parent = parentResult.rows[0] ?? null;
    }

    // Fetch children
    const childrenResult = await this.db.query(
      'SELECT id, name, slug FROM categories WHERE "parentId" = $1 AND "isActive" = true ORDER BY "sortOrder" ASC',
      [category.id],
    );

    // Fetch products with primary images and variants
    const productsResult = await this.db.query(
      `SELECT p.*, 
        (SELECT json_agg(pi ORDER BY pi."sortOrder" ASC) FROM product_images pi WHERE pi."productId" = p.id AND pi."isPrimary" = true) as images,
        (SELECT json_agg(pv) FROM product_variants pv WHERE pv."productId" = p.id) as variants
       FROM products p 
       WHERE p."categoryId" = $1 AND p."isActive" = true`,
      [category.id],
    );

    category.parent = parent;
    category.children = childrenResult.rows;
    category.products = productsResult.rows.map((p) => ({
      ...p,
      images: p.images ? p.images : [],
      variants: p.variants ? p.variants : [],
    }));
    category._count = { products: parseInt(category.product_count, 10) };
    delete category.product_count;

    return category;
  }

  async findBySlug(slug: string) {
    const result = await this.db.query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM products p WHERE p."categoryId" = c.id) as product_count
       FROM categories c 
       WHERE c.slug = $1`,
      [slug],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Category not found');
    }

    const category = result.rows[0];

    // Fetch parent
    let parent = null;
    if (category.parentId) {
      const parentResult = await this.db.query(
        'SELECT id, name, slug FROM categories WHERE id = $1',
        [category.parentId],
      );
      parent = parentResult.rows[0] ?? null;
    }

    // Fetch children
    const childrenResult = await this.db.query(
      'SELECT id, name, slug FROM categories WHERE "parentId" = $1 AND "isActive" = true ORDER BY "sortOrder" ASC',
      [category.id],
    );

    // Fetch products with primary images and variants
    const productsResult = await this.db.query(
      `SELECT p.*,
        (SELECT json_agg(pi ORDER BY pi."sortOrder" ASC) FROM product_images pi WHERE pi."productId" = p.id AND pi."isPrimary" = true) as images,
        (SELECT json_agg(pv) FROM product_variants pv WHERE pv."productId" = p.id) as variants
       FROM products p 
       WHERE p."categoryId" = $1 AND p."isActive" = true`,
      [category.id],
    );

    category.parent = parent;
    category.children = childrenResult.rows;
    category.products = productsResult.rows.map((p) => ({
      ...p,
      images: p.images ? p.images : [],
      variants: p.variants ? p.variants : [],
    }));
    category._count = { products: parseInt(category.product_count, 10) };
    delete category.product_count;

    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const { slug, ...rest } = updateCategoryDto;

    const existing = await this.db.query(
      'SELECT id, slug FROM categories WHERE id = $1',
      [id],
    );

    if (existing.rows.length === 0) {
      throw new NotFoundException('Category not found');
    }

    if (slug && slug !== existing.rows[0].slug) {
      const existingSlug = await this.db.query(
        'SELECT id FROM categories WHERE slug = $1',
        [slug],
      );
      if (existingSlug.rows.length > 0) {
        throw new ConflictException('Category with this slug already exists');
      }
    }

    const updateFields: string[] = [];
    const updateValues: unknown[] = [];
    let paramIndex = 1;

    if (slug !== undefined) {
      updateFields.push(`slug = $${paramIndex++}`);
      updateValues.push(slug);
    }
    if (rest.name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      updateValues.push(rest.name);
    }
    if (rest.description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      updateValues.push(rest.description);
    }
    if (rest.parentId !== undefined) {
      updateFields.push(`"parentId" = $${paramIndex++}`);
      updateValues.push(rest.parentId);
    }
    if (rest.imageUrl !== undefined) {
      updateFields.push(`"imageUrl" = $${paramIndex++}`);
      updateValues.push(rest.imageUrl);
    }
    if (rest.sortOrder !== undefined) {
      updateFields.push(`"sortOrder" = $${paramIndex++}`);
      updateValues.push(rest.sortOrder);
    }
    if (rest.isActive !== undefined) {
      updateFields.push(`"isActive" = $${paramIndex++}`);
      updateValues.push(rest.isActive);
    }

    updateFields.push(`"updatedAt" = NOW()`);
    updateValues.push(id);

    const result = await this.db.query(
      `UPDATE categories SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING id, name, slug, description, "parentId", "imageUrl", "sortOrder", "isActive", "createdAt", "updatedAt"`,
      updateValues,
    );

    return result.rows[0];
  }

  async remove(id: string) {
    const existing = await this.db.query(
      `SELECT c.id,
        (SELECT COUNT(*) FROM products p WHERE p."categoryId" = c.id) as product_count,
        (SELECT COUNT(*) FROM categories c2 WHERE c2."parentId" = c.id) as children_count
       FROM categories c 
       WHERE c.id = $1`,
      [id],
    );

    if (existing.rows.length === 0) {
      throw new NotFoundException('Category not found');
    }

    if (parseInt(existing.rows[0].product_count, 10) > 0) {
      throw new ConflictException('Cannot delete category with products');
    }

    if (parseInt(existing.rows[0].children_count, 10) > 0) {
      throw new ConflictException('Cannot delete category with subcategories');
    }

    await this.db.query('DELETE FROM categories WHERE id = $1', [id]);

    return { id };
  }
}
